const express = require('express');
const router = express.Router();
const Complaint = require('../../models/Complaint');
const authMiddleware = require('../../middlewares/auth');
const { roleCheck } = require('../../middlewares/roleCheck');
const { ROLES } = require('../../config/constants');
const { createNotification } = require('../../services/notificationService');

router.use(authMiddleware);

// ── Role helpers ──────────────────────────────────────────────────────────────
const STAFF_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF];

// ── POST /api/complaints — customer submits complaint ─────────────────────────
router.post('/', async (req, res) => {
    try {
        const { category, priority, subject, description, reservationId } = req.body;

        if (!category || !subject?.trim() || !description?.trim()) {
            return res.status(400).json({ message: 'category, subject and description are required' });
        }

        const complaint = await Complaint.create({
            submittedBy: req.user._id,
            category,
            priority: priority || 'MEDIUM',
            subject: subject.trim(),
            description: description.trim(),
            reservationId: reservationId || null,
        });

        await complaint.populate([
            { path: 'submittedBy', select: 'firstName lastName email phone employeeId' },
            { path: 'reservationId', select: 'reservationNumber roomId', populate: { path: 'roomId', select: 'roomNumber floor' } },
        ]);

        // Real-time notification to ADMIN, MANAGER, STAFF
        const isUrgent = complaint.priority === 'URGENT' || complaint.category === 'EMERGENCY';
        const submitter = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email;

        createNotification(req.io, {
            title: isUrgent ? `🚨 URGENT: ${complaint.subject}` : `New ${complaint.category.replace('_', ' ')} Complaint`,
            message: `${submitter} submitted: "${complaint.subject}" — Ticket ${complaint.ticketNumber}`,
            type: 'SYSTEM_ALERT',
            senderId: req.user._id,
            targetRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'],
            resourceId: complaint._id,
            resourceType: 'Complaint',
        });

        // Socket broadcast — immediate alert on staff dashboards
        if (req.io) {
            req.io.to('role:ADMIN').to('role:MANAGER').to('role:STAFF').to('role:SUPER_ADMIN')
                .emit('complaint:new', {
                    complaint,
                    isUrgent,
                    submittedBy: submitter,
                });
        }

        res.status(201).json({ message: 'Complaint submitted successfully', complaint });
    } catch (err) {
        res.status(500).json({ message: 'Failed to submit complaint', error: err.message });
    }
});

// ── GET /api/complaints — list (role-filtered) ────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { status, category, priority, page = 1, limit = 20 } = req.query;
        const isStaff = STAFF_ROLES.includes(req.user.role);

        const filter = {};

        // Customers only see their own complaints
        if (!isStaff) filter.submittedBy = req.user._id;

        if (status) filter.status = status;
        if (category) filter.category = category;
        if (priority) filter.priority = priority;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Complaint.countDocuments(filter);

        const complaints = await Complaint.find(filter)
            .populate('submittedBy', 'firstName lastName email employeeId')
            .populate('assignedTo', 'firstName lastName role employeeId')
            .populate('reservationId', 'reservationNumber')
            .sort({ priority: -1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Staff: hide internal responses from the output going to customers
        const sanitized = isStaff
            ? complaints
            : complaints.map((c) => ({
                ...c.toObject(),
                responses: c.responses.filter((r) => !r.isInternal),
            }));

        res.json({ complaints: sanitized, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch complaints', error: err.message });
    }
});

// ── GET /api/complaints/stats — summary for dashboard ────────────────────────
router.get('/stats',
    roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF),
    async (req, res) => {
        try {
            const [byStatus, byCategory, byPriority, total] = await Promise.all([
                Complaint.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
                Complaint.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
                Complaint.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
                Complaint.countDocuments(),
            ]);

            const avgRating = await Complaint.aggregate([
                { $match: { satisfactionRating: { $ne: null } } },
                { $group: { _id: null, avg: { $avg: '$satisfactionRating' } } },
            ]);

            res.json({ byStatus, byCategory, byPriority, total, avgRating: avgRating[0]?.avg || null });
        } catch (err) {
            res.status(500).json({ message: 'Failed to fetch stats', error: err.message });
        }
    }
);

// ── GET /api/complaints/:id — single complaint ────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const complaint = await Complaint.findById(req.params.id)
            .populate('submittedBy', 'firstName lastName email phone')
            .populate('assignedTo', 'firstName lastName role employeeId')
            .populate('reservationId', 'reservationNumber checkInDate checkOutDate')
            .populate('responses.respondedBy', 'firstName lastName role');

        if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

        const isStaff = STAFF_ROLES.includes(req.user.role);
        const isOwner = complaint.submittedBy._id.toString() === req.user._id.toString();

        if (!isStaff && !isOwner) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Filter internal responses for non-staff
        if (!isStaff) {
            complaint.responses = complaint.responses.filter((r) => !r.isInternal);
        }

        res.json({ complaint });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch complaint', error: err.message });
    }
});

// ── PATCH /api/complaints/:id — update status / assign ───────────────────────
router.patch('/:id',
    roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF),
    async (req, res) => {
        try {
            const { status, assignedTo, priority } = req.body;
            const complaint = await Complaint.findById(req.params.id);
            if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

            if (status) complaint.status = status;
            if (priority) complaint.priority = priority;
            if (assignedTo) complaint.assignedTo = assignedTo;

            if (status === 'RESOLVED' || status === 'CLOSED') {
                complaint.resolvedAt = new Date();
                complaint.resolvedBy = req.user._id;
            }

            await complaint.save();
            await complaint.populate([
                { path: 'submittedBy', select: 'firstName lastName email' },
                { path: 'assignedTo', select: 'firstName lastName role' },
            ]);

            // Notify customer when their complaint status changes
            if (status) {
                createNotification(req.io, {
                    title: `Complaint ${status === 'RESOLVED' ? 'Resolved' : 'Updated'}: ${complaint.subject}`,
                    message: `Your ticket ${complaint.ticketNumber} is now ${status.replace('_', ' ').toLowerCase()}.`,
                    type: 'SYSTEM_ALERT',
                    senderId: req.user._id,
                    receiverId: complaint.submittedBy._id,
                    resourceId: complaint._id,
                    resourceType: 'Complaint',
                });

                if (req.io) {
                    req.io.to(`user:${complaint.submittedBy._id}`).emit('complaint:updated', {
                        complaintId: complaint._id,
                        ticketNumber: complaint.ticketNumber,
                        status,
                    });
                }
            }

            res.json({ message: 'Complaint updated', complaint });
        } catch (err) {
            res.status(500).json({ message: 'Failed to update complaint', error: err.message });
        }
    }
);

// ── POST /api/complaints/:id/respond — add a response ─────────────────────────
router.post('/:id/respond', async (req, res) => {
    try {
        const { message, isInternal } = req.body;
        if (!message?.trim()) return res.status(400).json({ message: 'Message is required' });

        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

        const isStaff = STAFF_ROLES.includes(req.user.role);
        const isOwner = complaint.submittedBy.toString() === req.user._id.toString();

        if (!isStaff && !isOwner) {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Only staff can add internal notes
        const internal = isStaff && isInternal === true;

        complaint.responses.push({
            respondedBy: req.user._id,
            message: message.trim(),
            isInternal: internal,
        });

        // Auto-transition OPEN → IN_PROGRESS when staff responds
        if (isStaff && complaint.status === 'OPEN') {
            complaint.status = 'IN_PROGRESS';
        }

        await complaint.save();
        await complaint.populate('responses.respondedBy', 'firstName lastName role');

        const respondent = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();

        // Notify the other party
        if (isStaff && !internal) {
            // Staff responded → notify customer
            createNotification(req.io, {
                title: `Response on Ticket ${complaint.ticketNumber}`,
                message: `${respondent} replied to your complaint: "${message.trim().slice(0, 80)}..."`,
                type: 'SYSTEM_ALERT',
                senderId: req.user._id,
                receiverId: complaint.submittedBy,
                resourceId: complaint._id,
                resourceType: 'Complaint',
            });
            if (req.io) {
                req.io.to(`user:${complaint.submittedBy}`).emit('complaint:response', {
                    complaintId: complaint._id,
                    ticketNumber: complaint.ticketNumber,
                    respondent,
                    message: message.trim(),
                });
            }
        } else if (!isStaff) {
            // Customer responded → notify staff
            if (req.io) {
                req.io.to('role:ADMIN').to('role:MANAGER').to('role:STAFF').emit('complaint:customerReply', {
                    complaintId: complaint._id,
                    ticketNumber: complaint.ticketNumber,
                    customerName: respondent,
                    message: message.trim().slice(0, 80),
                });
            }
        }

        res.json({
            message: 'Response added',
            response: complaint.responses[complaint.responses.length - 1],
            status: complaint.status,
        });
    } catch (err) {
        res.status(500).json({ message: 'Failed to add response', error: err.message });
    }
});

// ── POST /api/complaints/:id/rate — customer rates resolution ─────────────────
router.post('/:id/rate', async (req, res) => {
    try {
        const { rating, comment } = req.body;
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating must be between 1 and 5' });
        }

        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) return res.status(404).json({ message: 'Complaint not found' });

        if (complaint.submittedBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Only the submitter can rate this complaint' });
        }
        if (!['RESOLVED', 'CLOSED'].includes(complaint.status)) {
            return res.status(400).json({ message: 'Can only rate resolved complaints' });
        }

        complaint.satisfactionRating = parseInt(rating);
        complaint.satisfactionComment = comment?.trim() || '';
        await complaint.save();

        res.json({ message: 'Thank you for your feedback!', rating: complaint.satisfactionRating });
    } catch (err) {
        res.status(500).json({ message: 'Failed to submit rating', error: err.message });
    }
});

module.exports = router;