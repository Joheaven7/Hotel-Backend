const mongoose = require('mongoose');

// A ChatSession groups messages between a customer and staff for a support conversation
const chatSessionSchema = new mongoose.Schema(
    {
        // The customer who initiated this support chat
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },

        // Optional: linked reservation
        reservationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Reservation',
            default: null,
        },

        // Staff member assigned to this session
        assignedStaff: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },

        status: {
            type: String,
            enum: ['WAITING', 'ACTIVE', 'CLOSED'],
            default: 'WAITING',
        },

        subject: {
            type: String,
            default: 'General Support',
            trim: true,
        },

        // Last message preview for inbox display
        lastMessage: {
            text: { type: String, default: '' },
            sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
            createdAt: { type: Date, default: null },
        },

        // Unread counts per role
        unreadByCustomer: { type: Number, default: 0 },
        unreadByStaff: { type: Number, default: 0 },

        closedAt: { type: Date, default: null },
        closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
    { timestamps: true }
);

chatSessionSchema.index({ customerId: 1, status: 1, createdAt: -1 });
chatSessionSchema.index({ assignedStaff: 1, status: 1, createdAt: -1 });
chatSessionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ChatSession', chatSessionSchema);