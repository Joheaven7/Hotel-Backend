const mongoose = require('mongoose');
const { MAINTENANCE_STATUS } = require('../config/constants');

const maintenanceSchema = new mongoose.Schema(
  {
    maintenanceNumber: {
      type: String,
      unique: true,
      // required: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: String,
    status: {
      type: String,
      enum: Object.values(MAINTENANCE_STATUS),
      default: MAINTENANCE_STATUS.OPEN,
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    blocksDates: [Date],
    startDate: Date,
    endDate: Date,
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    cost: Number,
    notes: String,  // ✅ ADDED: This field was missing!
  },
  { timestamps: true }
);

maintenanceSchema.pre('validate', async function (next) {
  if (!this.maintenanceNumber) {
    const count = await mongoose.model('Maintenance').countDocuments();
    this.maintenanceNumber = `MAINT-${Date.now()}-${count + 1}`;
  }
  next();
});

module.exports = mongoose.model('Maintenance', maintenanceSchema);