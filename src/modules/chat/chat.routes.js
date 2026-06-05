const express = require('express');
const router = express.Router();
const Message = require('../../models/Message');
const ChatSession = require('../../models/ChatSession');
const authMiddleware = require('../../middlewares/auth');
const { ROLES } = require('../../config/constants');

router.use(authMiddleware);

const STAFF_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF];
const isStaff = (role) => STAFF_ROLES.includes(role);

// ── POST /api/chat/sessions — customer starts a support session ──────────────
router.post('/sessions', async (req, res) => {
    try {
        const { subject, reservationId } = req.body;

        // Check for existing open session
        const existing = await ChatSession.findOne({
            customerId: req.user._id,
            status: { $in: ['WAITING', 'ACTIVE'] },
        });

        if (existing) {
            return res.json({ message: 'Existing session found', session: existing });
        }

        const session = await ChatSession.create({
            customerId: req.user._id,
            reservationId: reservationId || null,
            subject: subject?.trim() || 'General Support',
        });

        await session.populate('customerId', 'firstName lastName email');

        // Notify staff of new chat request
        if (req.io) {
            req.io.to('role:ADMIN').to('role:MANAGER').to('role:STAFF').to('role:SUPER_ADMIN')
                .emit('chat:newSession', {
                    session,
                    customerName: `${req.user.firstName} ${req.user.lastName}`.trim(),
                });
        }

        res.status(201).json({ message: 'Chat session started', session });
    } catch (err) {
        res.status(500).json({ message: 'Failed to start chat', error: err.message });
    }
});

// ── GET /api/chat/sessions — list sessions (role-filtered) ───────────────────
router.get('/sessions', async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const filter = {};

        if (!isStaff(req.user.role)) {
            // Customers only see their own sessions
            filter.customerId = req.user._id;
        }

        if (status) filter.status = status;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await ChatSession.countDocuments(filter);

        const sessions = await ChatSession.find(filter)
            .populate('customerId', 'firstName lastName email')
            .populate('assignedStaff', 'firstName lastName role')
            .populate('reservationId', 'reservationNumber')
            .sort({ 'lastMessage.createdAt': -1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.json({ sessions, total, page: parseInt(page) });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch sessions', error: err.message });
    }
});

// ── GET /api/chat/sessions/unread — unread count for badge ──────────────────
router.get('/sessions/unread', async (req, res) => {
    try {
        let count = 0;
        if (isStaff(req.user.role)) {
            count = await ChatSession.countDocuments({
                status: { $in: ['WAITING', 'ACTIVE'] },
                unreadByStaff: { $gt: 0 },
            });
        } else {
            count = await ChatSession.countDocuments({
                customerId: req.user._id,
                unreadByCustomer: { $gt: 0 },
            });
        }
        res.json({ count });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch unread count', error: err.message });
    }
});

// ── PATCH /api/chat/sessions/:id/assign — staff claims a session ─────────────
router.patch('/sessions/:id/assign', async (req, res) => {
    try {
        if (!isStaff(req.user.role)) {
            return res.status(403).json({ message: 'Only staff can claim sessions' });
        }

        const session = await ChatSession.findByIdAndUpdate(
            req.params.id,
            { assignedStaff: req.user._id, status: 'ACTIVE' },
            { new: true }
        ).populate('customerId', 'firstName lastName email');

        if (!session) return res.status(404).json({ message: 'Session not found' });

        // Notify customer that staff joined
        if (req.io) {
            req.io.to(`user:${session.customerId._id}`).emit('chat:staffJoined', {
                sessionId: session._id,
                staffName: `${req.user.firstName} ${req.user.lastName}`.trim(),
                staffRole: req.user.role,
            });
        }

        res.json({ message: 'Session claimed', session });
    } catch (err) {
        res.status(500).json({ message: 'Failed to assign session', error: err.message });
    }
});

// ── PATCH /api/chat/sessions/:id/close — close a session ────────────────────
router.patch('/sessions/:id/close', async (req, res) => {
    try {
        const session = await ChatSession.findById(req.params.id);
        if (!session) return res.status(404).json({ message: 'Session not found' });

        const isOwner = session.customerId.toString() === req.user._id.toString();
        if (!isStaff(req.user.role) && !isOwner) {
            return res.status(403).json({ message: 'Access denied' });
        }

        session.status = 'CLOSED';
        session.closedAt = new Date();
        session.closedBy = req.user._id;
        await session.save();

        if (req.io) {
            req.io.to(`chat:${session._id}`).emit('chat:sessionClosed', {
                sessionId: session._id,
                closedBy: `${req.user.firstName} ${req.user.lastName}`.trim(),
            });
        }

        res.json({ message: 'Session closed', session });
    } catch (err) {
        res.status(500).json({ message: 'Failed to close session', error: err.message });
    }
});

// ── GET /api/chat/sessions/:id/messages — fetch message history ──────────────
router.get('/sessions/:id/messages', async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;

        const session = await ChatSession.findById(req.params.id);
        if (!session) return res.status(404).json({ message: 'Session not found' });

        const isOwner = session.customerId.toString() === req.user._id.toString();
        if (!isStaff(req.user.role) && !isOwner) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Message.countDocuments({ reservationId: req.params.id, channelType: 'support', isDeleted: false });
        const messages = await Message.find({
            reservationId: req.params.id,
            channelType: 'support',
            isDeleted: false,
        })
            .populate('sender', 'firstName lastName role avatar')
            .sort({ createdAt: 1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Mark messages as read
        const userId = req.user._id;
        await Message.updateMany(
            {
                reservationId: req.params.id,
                channelType: 'support',
                'readBy.userId': { $ne: userId },
                sender: { $ne: userId },
            },
            { $push: { readBy: { userId } } }
        );

        // Reset unread counter
        if (isStaff(req.user.role)) {
            await ChatSession.findByIdAndUpdate(req.params.id, { unreadByStaff: 0 });
        } else {
            await ChatSession.findByIdAndUpdate(req.params.id, { unreadByCustomer: 0 });
        }

        res.json({ messages, total, page: parseInt(page) });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch messages', error: err.message });
    }
});

// ── POST /api/chat/sessions/:id/messages — send a message ───────────────────
router.post('/sessions/:id/messages', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text?.trim()) return res.status(400).json({ message: 'Message text is required' });
        if (text.length > 1000) return res.status(400).json({ message: 'Message too long (max 1000 chars)' });

        const session = await ChatSession.findById(req.params.id);
        if (!session) return res.status(404).json({ message: 'Session not found' });
        if (session.status === 'CLOSED') {
            return res.status(400).json({ message: 'This chat session is closed' });
        }

        const isOwner = session.customerId.toString() === req.user._id.toString();
        if (!isStaff(req.user.role) && !isOwner) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const message = await Message.create({
            channelType: 'support',
            reservationId: req.params.id, // using reservationId field to store sessionId for simplicity
            sender: req.user._id,
            text: text.trim(),
            readBy: [{ userId: req.user._id }],
        });

        await message.populate('sender', 'firstName lastName role avatar');

        // Update session last message and unread counts
        const isSenderStaff = isStaff(req.user.role);
        await ChatSession.findByIdAndUpdate(req.params.id, {
            'lastMessage.text': message.text,
            'lastMessage.sender': req.user._id,
            'lastMessage.createdAt': message.createdAt,
            ...(isSenderStaff
                ? { $inc: { unreadByCustomer: 1 } }
                : { $inc: { unreadByStaff: 1 } }),
        });

        // Real-time delivery to the session room
        if (req.io) {
            req.io.to(`chat:${req.params.id}`).emit('chat:message', {
                sessionId: req.params.id,
                message,
            });

            // Cross-notify the other party
            if (isSenderStaff) {
                req.io.to(`user:${session.customerId}`).emit('chat:message', {
                    sessionId: req.params.id,
                    message,
                });
            } else {
                // Notify staff: assigned staff + role rooms
                if (session.assignedStaff) {
                    req.io.to(`user:${session.assignedStaff}`).emit('chat:message', {
                        sessionId: req.params.id,
                        message,
                    });
                }
                req.io.to('role:ADMIN').to('role:MANAGER').to('role:STAFF').emit('chat:customerMessage', {
                    sessionId: req.params.id,
                    customerName: `${req.user.firstName} ${req.user.lastName}`.trim(),
                    preview: text.trim().slice(0, 60),
                });
            }
        }

        res.status(201).json({ message: 'Message sent', data: message });
    } catch (err) {
        res.status(500).json({ message: 'Failed to send message', error: err.message });
    }
});

// ── GET /api/chat/department/:dept — department channel messages ─────────────
router.get('/department/:dept', async (req, res) => {
    try {
        if (!isStaff(req.user.role)) {
            return res.status(403).json({ message: 'Internal channel — staff only' });
        }

        const { page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const messages = await Message.find({
            channelType: 'department',
            department: req.params.dept,
            isDeleted: false,
        })
            .populate('sender', 'firstName lastName role avatar employeeId')
            .sort({ createdAt: 1 })
            .skip(skip)
            .limit(parseInt(limit));

        res.json({ messages, department: req.params.dept });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch messages', error: err.message });
    }
});

// ── POST /api/chat/department/:dept — send to department channel ─────────────
router.post('/department/:dept', async (req, res) => {
    try {
        if (!isStaff(req.user.role)) {
            return res.status(403).json({ message: 'Internal channel — staff only' });
        }

        const { text } = req.body;
        if (!text?.trim()) return res.status(400).json({ message: 'Message is required' });

        const message = await Message.create({
            channelType: 'department',
            department: req.params.dept,
            sender: req.user._id,
            text: text.trim(),
            readBy: [{ userId: req.user._id }],
        });

        await message.populate('sender', 'firstName lastName role avatar employeeId');

        if (req.io) {
            req.io.to(`dept:${req.params.dept}`).emit('chat:departmentMessage', {
                department: req.params.dept,
                message,
            });
        }

        res.status(201).json({ message: 'Message sent', data: message });
    } catch (err) {
        res.status(500).json({ message: 'Failed to send message', error: err.message });
    }
});

module.exports = router;