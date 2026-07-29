const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, 'Permission key is required'],
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Permission display name is required'],
      trim: true,
    },
    module: {
      type: String,
      required: [true, 'Module category is required'],
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Permission', permissionSchema);
