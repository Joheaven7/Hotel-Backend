const mongoose = require('mongoose');

const hallSchema = new mongoose.Schema(
  {
    hallName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    floor: { type: Number, default: null },

    // ── Link to HallType ───────────────────────────────────────────────────
    hallTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HallType',
      default: null,
    },

    // ── Operational status ────────────────────────────────────────────────
    status: {
      type: String,
      enum: ['AVAILABLE', 'BOOKED', 'MAINTENANCE'],
      default: 'AVAILABLE',
    },

    housekeepingStatus: {
      type: String,
      enum: ['CLEAN', 'DIRTY', 'IN_PROGRESS', 'INSPECTING'],
      default: 'CLEAN',
    },
    lastCleanedAt: { type: Date, default: null },
    lastCleanedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // ── Legacy flat fields (backward compat) ──────────────────────────────
    capacity: { type: Number, default: 10 },
    pricePerHour: { type: Number, default: 0 },
    amenities: [String],
    description: { type: String, default: '' },
    images: [String],

    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Sync legacy fields from hallTypeId
hallSchema.pre('save', async function (next) {
  if (this.isModified('hallTypeId') && this.hallTypeId) {
    try {
      const HallType = mongoose.model('HallType');
      const ht = await HallType.findById(this.hallTypeId);
      if (ht) {
        this.capacity = ht.maxOccupancy;
        this.pricePerHour = ht.basePricePerHour;
        this.amenities = ht.amenities;
        this.description = ht.description;
        this.images = ht.images;
      }
    } catch (_) { }
  }
  next();
});

module.exports = mongoose.model('Hall', hallSchema);