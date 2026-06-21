const mongoose = require('mongoose');
const { RESERVATION_STATUS, PAYMENT_STATUS } = require('../config/constants');

const reservationSchema = new mongoose.Schema(
  {
    reservationNumber: { type: String, unique: true, required: true },

    // ── Who is this reservation for ───────────────────────────────────────
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null for walk-in guests without accounts
    },

    // Customer details for walk-in guests
    customer: {
      fullName: String,
      email: String,
      phone: String,
      idNumber: String
    },

    // Walk-in guest fields (used when customerId is null)
    guestName: { type: String, default: '' },
    guestEmail: { type: String, default: '' },
    guestPhone: { type: String, default: '' },

    // ── What was requested (type) vs what was assigned (physical unit) ────
    roomTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoomType',
      default: null,
    },
    hallTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HallType',
      default: null,
    },

    // Assigned physical unit (set by ROH engine, never by customer)
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
    },
    hallId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hall',
      default: null,
    },

    // ── Dates ─────────────────────────────────────────────────────────────
    checkInDate: { type: Date, required: true },
    checkOutDate: { type: Date, required: true },
    numberOfGuests: { type: Number, required: true, min: 1 },

    // ── Pricing ───────────────────────────────────────────────────────────
    totalPrice: { type: Number, required: true, min: 0 },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.UNPAID,
    },

    // ── Status ────────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: Object.values(RESERVATION_STATUS),
      default: RESERVATION_STATUS.PENDING,
    },

    // ── Walk-in tracking ─────────────────────────────────────────────────
    createdBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      role: String
    },
    // The staff member who created this reservation (front desk / walk-in)
    createdByStaff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isWalkIn: { type: Boolean, default: false },
    reminderSent: { type: Boolean, default: false },

    // ── Misc ──────────────────────────────────────────────────────────────
    specialRequests: String,
    notes: String,
    checkedInAt: Date,
    checkedOutAt: Date,
    isBlockedByMaintenance: { type: Boolean, default: false },

    // ── Soft delete ─────────────────────────────────────────────────────
    deleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

reservationSchema.index({ roomId: 1, status: 1, checkInDate: 1, checkOutDate: 1 });
reservationSchema.index({ hallId: 1, status: 1, checkInDate: 1, checkOutDate: 1 });

reservationSchema.pre('save', async function (next) {
  if (!this.reservationNumber) {
    const count = await mongoose.model('Reservation').countDocuments();
    this.reservationNumber = `RES-${Date.now()}-${count + 1}`;
  }

  if (this.checkInDate >= this.checkOutDate) {
    return next(new Error('Check-out date must be after check-in date.'));
  }

  if (this.status === 'WAITLIST') return next();

  if (
    !this.isNew &&
    !this.isModified('checkInDate') &&
    !this.isModified('checkOutDate') &&
    !this.isModified('roomId') &&
    !this.isModified('hallId') &&
    !this.isModified('status')
  ) {
    return next();
  }

  // Must have either roomId or hallId assigned
  if (!this.roomId && !this.hallId) {
    return next(new Error('A reservation must specify either a room or a hall.'));
  }

  const ReservationModel = mongoose.model('Reservation');
  const query = {
    _id: { $ne: this._id },
    status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
    $or: [{ checkInDate: { $lt: this.checkOutDate }, checkOutDate: { $gt: this.checkInDate } }],
  };

  if (this.roomId) query.roomId = this.roomId;
  else query.hallId = this.hallId;

  try {
    const duplicate = await ReservationModel.findOne(query);
    if (duplicate) {
      return next(new Error(
        `Already booked from ${new Date(duplicate.checkInDate).toLocaleDateString()} to ${new Date(duplicate.checkOutDate).toLocaleDateString()}.`
      ));
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Reservation', reservationSchema);