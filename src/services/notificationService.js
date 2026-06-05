const Notification = require('../models/Notification');

/**
 * Create a notification and emit it via socket.io
 *
 * @param {object} io          - socket.io server instance
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.message
 * @param {string} options.type         - NOTIFICATION TYPE enum
 * @param {string[]} options.targetRoles - roles that should see it
 * @param {string} [options.userId]     - specific user (personal notification)
 * @param {string} [options.resourceId]
 * @param {string} [options.resourceType]
 */
const createNotification = async (io, options) => {
  try {
    const { title, message, type, targetRoles = [], userId = null, resourceId = null, resourceType = '' } = options;

    const notification = await Notification.create({
      title,
      message,
      type,
      targetRoles,
      userId,
      resourceId,
      resourceType,
    });

    const payload = {
      _id:         notification._id,
      title,
      message,
      type,
      targetRoles,
      userId,
      resourceId,
      resourceType,
      isRead:    false,
      createdAt: notification.createdAt,
    };

    if (!io) return notification;

    // Emit to specific user (personal notification)
    if (userId) {
      io.to(`user:${userId}`).emit('notification:new', payload);
    }

    // Emit to each target role
    if (targetRoles.length > 0) {
      targetRoles.forEach((role) => {
        io.to(`role:${role}`).emit('notification:new', payload);
      });
    }

    // If no roles and no user — broadcast to all
    if (!userId && targetRoles.length === 0) {
      io.emit('notification:new', payload);
    }

    return notification;
  } catch (error) {
    // Non-blocking — don't crash the calling controller
    console.error('Notification create error:', error.message);
    return null;
  }
};

module.exports = { createNotification };