const mongoose = require('mongoose');
const { PAYROLL_STATUS } = require('../config/constants');

const payrollSchema = new mongoose.Schema(
  {
    payrollNumber: { type: String, unique: true, required: true },

    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
      required: true,
    },

    baseSalary: { type: Number, required: true, min: 0 },
    bonus:      { type: Number, default: 0, min: 0 },
    bonusReason:{ type: String, default: '' },
    deductions: { type: Number, default: 0, min: 0 },
    deductionReason: { type: String, default: '' },
    netSalary:  { type: Number, required: true },

    month: { type: String, required: true },

    // ── Approval workflow ─────────────────────────────────────────────────
    approvalStatus: {
      type:    String,
      enum:    Object.values(PAYROLL_STATUS),
      default: PAYROLL_STATUS.DRAFT,
    },

    // Who created this payroll entry (HR or ADMIN)
    createdBy: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null,
    },

    // Manager who approved/rejected
    approvedBy: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null,
    },
    approvedAt:     { type: Date,   default: null },
    rejectedReason: { type: String, default: '' },

    // Accountant who executed payment
    isPaid:  { type: Boolean, default: false },
    paidAt:  { type: Date,    default: null },
    paidBy: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null,
    },

    notes: { type: String, default: '' },

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

payrollSchema.pre('save', async function (next) {
  if (!this.payrollNumber) {
    const count         = await mongoose.model('Payroll').countDocuments();
    this.payrollNumber  = `PAYROLL-${Date.now()}-${count + 1}`;
  }
  next();
});

module.exports = mongoose.model('Payroll', payrollSchema);