const mongoose = require('mongoose');

const CATEGORIES = ['ROOM_SERVICE', 'MAINTENANCE', 'HOUSEKEEPING', 'NOISE', 'BILLING', 'STAFF_CONDUCT', 'FOOD', 'EMERGENCY', 'GENERAL', 'COMPLIMENT'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const STATUSES   = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const complaintSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, unique: true },

    // Who submitted
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
      required: true,
    },

    // Attached reservation (optional but useful)
    reservationId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'Reservation',
      default: null,
    },

    // Category drives which staff see it
    category: {
      type:     String,
      enum:     CATEGORIES,
      required: true,
    },

    priority: {
      type:    String,
      enum:    PRIORITIES,
      default: 'MEDIUM',
    },

    subject: {
      type:     String,
      required: true,
      trim:     true,
      maxlength: 120,
    },

    description: {
      type:     String,
      required: true,
      trim:     true,
      maxlength: 2000,
    },

    status: {
      type:    String,
      enum:    STATUSES,
      default: 'OPEN',
    },

    // Staff assigned to resolve this
    assignedTo: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null,
    },

    // Thread of responses (staff ↔ customer)
    responses: [
      {
        respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        message:     { type: String, required: true, maxlength: 1000 },
        isInternal:  { type: Boolean, default: false }, // internal notes not shown to customer
        createdAt:   { type: Date,   default: Date.now },
      },
    ],

    resolvedAt: { type: Date,   default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Customer rating after resolution (1-5)
    satisfactionRating: { type: Number, min: 1, max: 5, default: null },
    satisfactionComment: { type: String, default: '' },
  },
  { timestamps: true }
);

// Auto-generate ticket number
complaintSchema.pre('save', async function (next) {
  if (!this.ticketNumber) {
    const count = await mongoose.model('Complaint').countDocuments();
    const year  = new Date().getFullYear();
    this.ticketNumber = `TKT-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Auto-set priority for EMERGENCY
complaintSchema.pre('save', function (next) {
  if (this.isNew && this.category === 'EMERGENCY') {
    this.priority = 'URGENT';
  }
  next();
});

complaintSchema.index({ submittedBy: 1, createdAt: -1 });
complaintSchema.index({ status: 1, priority: -1, createdAt: -1 });
complaintSchema.index({ category: 1, status: 1 });

module.exports = mongoose.model('Complaint', complaintSchema);