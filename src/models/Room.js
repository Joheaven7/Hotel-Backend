const mongoose = require('mongoose');
const { ROOM_STATUS } = require('../config/constants');

const HOUSEKEEPING_STATUS = ['CLEAN', 'DIRTY', 'IN_PROGRESS', 'INSPECTING'];

const roomSchema = new mongoose.Schema(
  {
    roomNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    floor: { type: Number, default: null },

    // ── Link to RoomType (Step 1 schema) ─────────────────────────────────
    roomTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RoomType',
      default: null,
    },

    // ── Operational status ────────────────────────────────────────────────
    status: {
      type: String,
      enum: Object.values(ROOM_STATUS),
      default: ROOM_STATUS.AVAILABLE,
    },

    // ── Housekeeping status ───────────────────────────────────────────────
    housekeepingStatus: {
      type: String,
      enum: HOUSEKEEPING_STATUS,
      default: 'CLEAN',
    },
    lastCleanedAt: { type: Date, default: null },
    lastCleanedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // ── Legacy flat fields (backward compat — populated from roomTypeId) ──
    // These let old code still work until fully migrated
    type: { type: String, enum: ['SINGLE', 'DOUBLE', 'SUITE', 'DELUXE', 'PRESIDENTIAL', 'FAMILY', 'HONEYMOON', 'TWIN', 'EXECUTIVE', 'STANDARD'], default: 'STANDARD' },
    capacity: { type: Number, default: 2 },
    pricePerNight: { type: Number, default: 0 },
    amenities: [String],
    description: { type: String, default: '' },
    images: [String],

    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// When roomTypeId is set, auto-populate legacy fields so existing code still works
roomSchema.pre('save', async function (next) {
  if (this.isModified('roomTypeId') && this.roomTypeId) {
    try {
      const RoomType = mongoose.model('RoomType');
      const rt = await RoomType.findById(this.roomTypeId);
      if (rt) {
        this.capacity = rt.maxOccupancy;
        this.pricePerNight = rt.basePricePerNight;
        this.amenities = rt.amenities;
        this.description = rt.description;
        this.images = rt.images;
        // Map name to legacy type enum (best-effort)
        const nameLower = rt.name.toLowerCase();
        if (nameLower.includes('suite')) this.type = 'SUITE';
        else if (nameLower.includes('deluxe')) this.type = 'DELUXE';
        else if (nameLower.includes('double')) this.type = 'DOUBLE';
        else if (nameLower.includes('family')) this.type = 'FAMILY';
        else if (nameLower.includes('twin')) this.type = 'TWIN';
        else if (nameLower.includes('presid')) this.type = 'PRESIDENTIAL';
        else if (nameLower.includes('honey')) this.type = 'HONEYMOON';
        else if (nameLower.includes('execut')) this.type = 'EXECUTIVE';
        else this.type = 'SINGLE';
      }
    } catch (_) { }
  }
  next();
});

roomSchema.index({ status: 1, isActive: 1 });
roomSchema.index({ roomTypeId: 1 });

module.exports = mongoose.model('Room', roomSchema);