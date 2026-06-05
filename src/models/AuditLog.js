const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Snapshot of user data at time of action — stays forever
    userName: { type: String, required: true },
    userEmail: { type: String },
    userRole: { type: String },
    actionType: {
      type: String,
      enum: [
        'LOGIN',
        'LOGOUT',
        'ROLE_CHANGE',
        'USER_CREATE',
        'USER_UPDATE',
        'USER_DELETE',
        'USER_RESTORE',
        'RESERVATION_CREATE',
        'RESERVATION_CANCEL',
        'RESERVATION_CONFIRM',
        'RESERVATION_CHECKIN',
        'RESERVATION_CHECKOUT',
        'PAYMENT_PROCESS',
        'PAYMENT_REFUND',
        'ROOM_CRUD',
        'HALL_CRUD',
        'PAYROLL_CREATE',
        'PAYROLL_PAID',
        'MAINTENANCE_CREATE',
        'MAINTENANCE_UPDATE',
        'SETTINGS_UPDATE',
      ],
      required: true,
    },
    resource: { type: String, required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
    details: { type: mongoose.Schema.Types.Mixed },
    beforeState: { type: mongoose.Schema.Types.Mixed, default: null },
    afterState: { type: mongoose.Schema.Types.Mixed, default: null },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

// TTL index — auto-delete logs older than 90 days
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Indexes for fast queries
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ actionType: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);