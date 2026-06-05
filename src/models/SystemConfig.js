const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema(
  {
    overbookingLimit: {
      type: Number,
      default: 5,
      min: 0,
    },
    // Add other system-wide configurations here as needed
  },
  { timestamps: true }
);

module.exports = mongoose.model('SystemConfig', systemConfigSchema);
