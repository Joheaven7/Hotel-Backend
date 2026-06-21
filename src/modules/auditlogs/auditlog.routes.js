const express = require('express');
const router = express.Router();
const AuditLog = require('../../models/AuditLog');
const authMiddleware = require('../../middlewares/auth');
const { roleCheck } = require('../../middlewares/roleCheck');
const { ROLES } = require('../../config/constants');

// All audit log routes — SUPER_ADMIN only
router.use(authMiddleware);
router.use(roleCheck(ROLES.SUPER_ADMIN));

router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      userId,
      actionType,
      startDate,
      endDate,
    } = req.query;

    const filter = {};
    if (userId) filter.userId = userId;
    if (actionType) filter.actionType = actionType;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59));
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await AuditLog.countDocuments(filter);
    const logs = await AuditLog.find(filter)
      .populate('userId', 'firstName lastName email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({ logs, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch audit logs', error: error.message });
  }
});

// GET /api/auditlogs/summary — counts per action type (for dashboard widget)
router.get('/summary', async (req, res) => {
  try {
    const since = new Date(new Date().setDate(new Date().getDate() - 7)); // last 7 days
    const summary = await AuditLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: '$actionType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const recentLogins = await AuditLog.find({ actionType: 'LOGIN' })
      .populate('userId', 'firstName lastName email role')
      .sort({ createdAt: -1 })
      .limit(5);
    res.json({ summary, recentLogins, since });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch summary', error: error.message });
  }
});

module.exports = router;