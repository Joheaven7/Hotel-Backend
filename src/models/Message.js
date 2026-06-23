const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    // Channel types:
    // 'support'    — Customer ↔ Staff (one customer, one or more staff)
    // 'department' — Internal staff ↔ staff by department
    // 'direct'     — Staff ↔ Staff direct message
    channelType: {
      type:     String,
      enum:     ['support', 'department', 'direct'],
      required: true,
    },

    // For 'support': the reservation this chat is about (optional)
    reservationId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'Reservation',
      default: null,
    },

    // For 'department': which department channel
    department: {
      type:    String,
      default: null,
    },

    // For 'direct': the two participants
    // For 'support': sender is customer, receiver is null (broadcast to staff role)
    senderId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    receiverId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null,
    },

    // The message content
    text: {
      type:      String,
      required:  true,
      trim:      true,
      maxlength: 1000,
    },

    // Read receipts — array of userIds who have read this message
    readBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        readAt: { type: Date, default: Date.now },
      },
    ],

    // Soft delete (message recalled)
    isDeleted:   { type: Boolean, default: false },
    deletedAt:   { type: Date,   default: null },
  },
  { timestamps: true }
);

// TTL — auto-delete messages older than 90 days
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Fast query indexes
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ channelType: 1, department: 1, createdAt: -1 });
messageSchema.index({ reservationId: 1, createdAt: 1 });

messageSchema.pre('validate', function(next) {
  if (this.channelType === 'direct' && !this.receiverId) {
    return next(new Error('receiverId is required for direct messages.'));
  }
  if (this.channelType === 'department' && !this.department) {
    return next(new Error('department is required for department messages.'));
  }
  if (this.receiverId && this.department) {
    return next(new Error('Message cannot have both receiverId and department.'));
  }
  next();
});

module.exports = mongoose.model('Message', messageSchema);