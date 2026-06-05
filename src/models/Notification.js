const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'RESERVATION_CREATED', 'RESERVATION_UPDATED', 'RESERVATION_CANCELLED',
        'RESERVATION_CONFIRMED', 'RESERVATION_CHECKIN', 'RESERVATION_CHECKOUT',
        'PAYMENT_CREATED', 'PAYMENT_PAID', 'PAYMENT_FAILED',
        'PAYROLL_CREATED', 'PAYROLL_APPROVED', 'PAYROLL_PAID', 'PAYROLL_REJECTED',
        'STAFF_CREATED', 'STAFF_UPDATED',
        'MAINTENANCE_CREATED', 'MAINTENANCE_UPDATED',
        'ROLE_CHANGED', 'SYSTEM_ALERT',
      ],
      required: true,
    },
    // Which roles should see this notification (empty = all roles)
    targetRoles: [{ type: String, enum: ['SUPER_ADMIN', 'ADMIN', 'HR', 'ACCOUNTANT', 'STAFF', 'CUSTOMER'] }],
    // Specific user (for personal notifications like booking confirmation)
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Resource reference (reservation ID, payment ID, etc.)
    resourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    resourceType: { type: String, default: '' },
    isRead: { type: Boolean, default: false },
    readBy: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      readAt: { type: Date, default: Date.now },
    }],
  },
  { timestamps: true }
);

// TTL — auto-delete notifications older than 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
notificationSchema.index({ targetRoles: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);