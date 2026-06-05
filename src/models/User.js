const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    // ── Identity ─────────────────────────────────────────────────────────────
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    name: { type: String, trim: true },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email'],
    },

    password: {
      type: String,
      required: false,
      minlength: 6,
      select: false,
    },

    phone: { type: String, trim: true },
    avatar: { type: String, default: null }, // Cloudinary URL

    // ── Role & Access ─────────────────────────────────────────────────────────
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'HR', 'ACCOUNTANT', 'STAFF', 'CUSTOMER'],
      default: 'CUSTOMER',
    },

    // ── Structured ID (auto-generated) ────────────────────────────────────────
    // Format: STF-2026-001, CUS-2026-042, SPA-2026-001
    employeeId: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
    },

    // ── Employment Details (staff only) ───────────────────────────────────────
    department: { type: String, default: '' },
    position: { type: String, default: '' },  // e.g. "Receptionist", "Cleaning Staff"
    workDescription: { type: String, default: '' },  // specific responsibilities
    baseSalary: { type: Number, default: 0, min: 0 },
    hireDate: { type: Date, default: null },
    employmentStatus: {
      type: String,
      enum: ['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED'],
      default: 'ACTIVE',
    },

    // ── Account flags ─────────────────────────────────────────────────────────
    isActive: { type: Boolean, default: true, required: true },
    isEmailVerified: { type: Boolean, default: false },

    // ── Tracking ──────────────────────────────────────────────────────────────
    lastLoginAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // ── OAuth / Tokens ────────────────────────────────────────────────────────
    googleId: String,
    facebookId: String,
    refreshToken: { type: String, select: false },
  },
  { timestamps: true }
);

// ── Pre-find: exclude soft-deleted users by default ────────────────────────
userSchema.pre(/^find/, function (next) {
  const options = this.getOptions();
  if (options && options.includeDeleted) {
    // bypass the deletedAt filter
  } else {
    this.where({ deletedAt: null });
  }
  next();
});

// ── Pre-save ───────────────────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  // Sync name ↔ firstName/lastName
  if (this.firstName || this.lastName) {
    this.name = `${this.firstName || ''} ${this.lastName || ''}`.trim();
  } else if (this.name) {
    const parts = this.name.split(' ');
    this.firstName = parts[0] || '';
    this.lastName = parts.slice(1).join(' ') || '';
  }
  if (!this.name) this.name = this.email.split('@')[0];

  // Generate structured employeeId on first creation
  if (!this.employeeId && this.isNew) {
    try {
      const year = new Date().getFullYear();
      const PREFIX = {
        SUPER_ADMIN: 'SPA',
        ADMIN: 'ADM',
        MANAGER: 'MNG',
        HR: 'HR',
        ACCOUNTANT: 'ACT',
        STAFF: 'STF',
        CUSTOMER: 'CUS',
      };
      const prefix = PREFIX[this.role] || 'USR';
      // Use random bytes or a portion of the ObjectId to ensure uniqueness and prevent race condition
      const uniqueSuffix = this._id.toString().slice(-4).toUpperCase();
      this.employeeId = `${prefix}-${year}-${uniqueSuffix}`;
    } catch (_) {
      // Non-blocking — fall back to timestamp-based ID
      this.employeeId = `USR-${Date.now()}`;
    }
  }

  // Set hireDate on first save for non-customers
  if (this.isNew && this.role !== 'CUSTOMER' && !this.hireDate) {
    this.hireDate = new Date();
  }

  // Hash password
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);