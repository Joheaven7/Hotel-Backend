const express = require('express');
const router  = express.Router();
const Notification = require('../../models/Notification');
const authMiddleware = require('../../middlewares/auth');

router.use(authMiddleware);

// GET /api/notifications — fetch for current user's role + personal
router.get('/', async (req, res) => {
  try {
    const { _id: userId, role } = req.user;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const filter = {
      $or: [
        { targetRoles: role },
        { userId: userId },
      ],
    };

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Notification.countDocuments(filter),
      Notification.countDocuments({
        ...filter,
        'readBy.userId': { $ne: userId },
      }),
    ]);

    // Mark isRead per-user using readBy array
    const enriched = notifications.map((n) => ({
      ...n.toObject(),
      isRead: n.readBy.some((r) => r.userId.toString() === userId.toString()),
    }));

    res.json({ notifications: enriched, total, unreadCount, page: parseInt(page) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch notifications', error: error.message });
  }
});

// GET /api/notifications/unread-count — for the badge
router.get('/unread-count', async (req, res) => {
  try {
    const { _id: userId, role } = req.user;
    const filter = {
      $or: [{ targetRoles: role }, { userId }],
      'readBy.userId': { $ne: userId },
    };
    const count = await Notification.countDocuments(filter);
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch count', error: error.message });
  }
});

// PATCH /api/notifications/:id/read — mark single as read
router.patch('/:id/read', async (req, res) => {
  try {
    const { _id: userId } = req.user;
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ message: 'Not found' });

    const alreadyRead = notification.readBy.some(
      (r) => r.userId.toString() === userId.toString()
    );
    if (!alreadyRead) {
      notification.readBy.push({ userId });
      await notification.save();
    }
    res.json({ message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to mark as read', error: error.message });
  }
});

// PATCH /api/notifications/read-all — mark all as read
router.patch('/read-all', async (req, res) => {
  try {
    const { _id: userId, role } = req.user;
    const filter = {
      $or: [{ targetRoles: role }, { userId }],
      'readBy.userId': { $ne: userId },
    };
    const unread = await Notification.find(filter).select('_id readBy');
    await Promise.all(
      unread.map((n) => {
        n.readBy.push({ userId });
        return n.save();
      })
    );
    res.json({ message: 'All marked as read', count: unread.length });
  } catch (error) {
    res.status(500).json({ message: 'Failed to mark all as read', error: error.message });
  }
});

module.exports = router;