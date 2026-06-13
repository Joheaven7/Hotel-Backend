const Payroll = require('../../models/Payroll');
const User = require('../../models/User');
const { ROLES, PAYROLL_STATUS } = require('../../config/constants'); // Added PAYROLL_STATUS here safely
const { createNotification } = require('../../services/notificationService');
// ─── Create monthly payroll ───────────────────────────────────────────────────
// FIX: payrollNumber is now generated here before insertMany(), because
// Mongoose pre('save') hooks do NOT fire on insertMany().
const createMonthlyPayroll = async (req, res) => {
  try {
    const { month, baseSalaryMap = {}, bonusMap = {}, deductionsMap = {} } = req.body;

    // Validate month format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: 'Month must be in YYYY-MM format' });
    }

    // Check if payroll already exists for this month
    const existingCount = await Payroll.countDocuments({ month });
    if (existingCount > 0) {
      return res.status(409).json({
        message: `Payroll already exists for ${month}`,
        count: existingCount,
      });
    }

    // Get all active hotel workers except customers
    const staffMembers = await User.find({
      role: { $ne: ROLES.CUSTOMER },
      isActive: true,
    });

    if (staffMembers.length === 0) {
      return res.status(400).json({ message: 'No active payroll-eligible workers with a base salary found' });
    }

    // Get current count once to generate unique payroll numbers
    const existingTotal = await Payroll.countDocuments();

    const payrollEntries = staffMembers.map((staff, index) => {
      const submittedSalary = parseFloat(baseSalaryMap[staff._id.toString()]);
      const baseSalary = Number.isFinite(submittedSalary) ? submittedSalary : (staff.baseSalary || 0);
      const bonus = parseFloat(bonusMap[staff._id.toString()] || 0);
      const deductions = parseFloat(deductionsMap[staff._id.toString()] || 0);
      const netSalary = baseSalary + bonus - deductions;

      return {
        // FIX: Generate payrollNumber here — pre('save') doesn't run on insertMany
        payrollNumber: `PAYROLL-${Date.now()}-${existingTotal + index + 1}`,
        staffId: staff._id,
        baseSalary,
        bonus,
        deductions,
        netSalary,
        month,
        isPaid: false,
        paidAt: null,
        paidBy: null,
      };
    });

    const inserted = await Payroll.insertMany(payrollEntries);

    // Populate staffId so the frontend preview can show names/departments
    const populated = await Payroll.find({ _id: { $in: inserted.map((p) => p._id) } })
      .populate('staffId', 'firstName lastName email department')
      .sort({ createdAt: -1 });

    const totalNetSalary = populated.reduce((sum, p) => sum + p.netSalary, 0);

    // Emit socket event if io is available
    if (req.io) {
      req.io.emit('payroll:created', {
        month,
        count: populated.length,
        totalPayroll: totalNetSalary,
      });
    }

    res.status(201).json({
      message: `Payroll created for ${month}`,
      month,
      count: populated.length,
      totalNetSalary,
      payrollEntries: populated,
    });
    createNotification(req.io, {
      title:        'Payroll Draft Created',
      message:      `Payroll for ${month} created with ${populated.length} staff entries.`,
      type:         'PAYROLL_CREATED',
      targetRoles:  ['SUPER_ADMIN', 'ADMIN', 'HR'],
      resourceType: 'Payroll',
    });
  } catch (error) {
    console.error('createMonthlyPayroll error:', error);
    res.status(500).json({ message: 'Failed to create payroll', error: error.message });
  }
};

// ─── Get payroll workers ────────────────────────────────────────────────────
const getPayrollWorkers = async (req, res) => {
  try {
    const { search, roles, page = 1, limit = 50 } = req.query;
    const query = { isActive: true };
    const roleValues = (roles || '')
      .split(',')
      .map((role) => role.trim())
      .filter(Boolean);

    if (roleValues.length > 0) {
      query.role = roleValues.length === 1 ? roleValues[0] : { $in: roleValues };
    } else {
      query.role = { $ne: ROLES.CUSTOMER };
    }

    if (search) {
      const sanitizedSearch = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      query.$or = [
        { firstName: { $regex: sanitizedSearch, $options: 'i' } },
        { lastName: { $regex: sanitizedSearch, $options: 'i' } },
        { email: { $regex: sanitizedSearch, $options: 'i' } },
        { role: { $regex: sanitizedSearch, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [workers, total] = await Promise.all([
      User.find(query)
        .select('-password -refreshToken')
        .sort({ role: -1, firstName: 1, lastName: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    res.json({
      workers,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.error('getPayrollWorkers error:', error);
    res.status(500).json({ message: 'Failed to fetch payroll workers', error: error.message });
  }
};

// ── Get payroll by month ─────────────────────────────────────────────────────
const getPayrollByMonth = async (req, res) => {
  try {
    const { month } = req.params;
    const { page = 1, limit = 10, showDeleted } = req.query;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: 'Month must be in YYYY-MM format' });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build filter — by default exclude soft-deleted
    const filter = { month };
    if (showDeleted === 'true' && ['SUPER_ADMIN', 'HR'].includes(req.user?.role)) {
      filter.deleted = true;
    } else {
      filter.deleted = { $ne: true };
    }

    const [payrollEntries, total, totals] = await Promise.all([
      Payroll.find(filter)
        .populate('staffId', 'firstName lastName email department baseSalary')
        .populate('paidBy', 'firstName lastName')
        .populate('deletedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),

      Payroll.countDocuments(filter),

      Payroll.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalBaseSalary: { $sum: '$baseSalary' },
            totalBonus: { $sum: '$bonus' },
            totalDeductions: { $sum: '$deductions' },
            totalNetSalary: { $sum: '$netSalary' },
            paidCount: { $sum: { $cond: ['$isPaid', 1, 0] } },
            pendingCount: { $sum: { $cond: ['$isPaid', 0, 1] } },
          },
        },
      ]),
    ]);

    res.json({
      month,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
      total,
      totals: totals[0] || {
        totalBaseSalary: 0,
        totalBonus: 0,
        totalDeductions: 0,
        totalNetSalary: 0,
        paidCount: 0,
        pendingCount: 0,
      },
      payrollEntries,
    });
  } catch (error) {
    console.error('getPayrollByMonth error:', error);
    res.status(500).json({ message: 'Failed to fetch payroll', error: error.message });
  }
};

// ─── Get all payroll entries ──────────────────────────────────────────────────
const getAllPayroll = async (req, res) => {
  try {
    const { staffId, isPaid, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (staffId) filter.staffId = staffId;
    if (isPaid !== undefined) filter.isPaid = isPaid === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [payrollEntries, total] = await Promise.all([
      Payroll.find(filter)
        .populate('staffId', 'firstName lastName email department baseSalary')
        .populate('paidBy', 'firstName lastName')
        .sort({ month: -1 })
        .skip(skip)
        .limit(parseInt(limit)),

      Payroll.countDocuments(filter),
    ]);

    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
      payrollEntries,
    });
  } catch (error) {
    console.error('getAllPayroll error:', error);
    res.status(500).json({ message: 'Failed to fetch payroll', error: error.message });
  }
};

// ─── Get single payroll entry ─────────────────────────────────────────────────
const getPayrollById = async (req, res) => {
  try {
    const { payrollId } = req.params;

    const payroll = await Payroll.findById(payrollId)
      .populate('staffId', 'firstName lastName email department baseSalary phone')
      .populate('paidBy', 'firstName lastName email');

    if (!payroll) {
      return res.status(404).json({ message: 'Payroll entry not found' });
    }

    res.json(payroll);
  } catch (error) {
    console.error('getPayrollById error:', error);
    res.status(500).json({ message: 'Failed to fetch payroll', error: error.message });
  }
};

// ─── Update payroll (bonus & deductions only, unpaid entries only) ─────────────
const updatePayroll = async (req, res) => {
  try {
    const { payrollId } = req.params;
    const { bonus, deductions, notes } = req.body;

    const payroll = await Payroll.findById(payrollId);
    if (!payroll) {
      return res.status(404).json({ message: 'Payroll entry not found' });
    }

    if (payroll.isPaid) {
      return res.status(400).json({
        message: 'Cannot update a payroll entry that has already been paid',
      });
    }

    if (bonus !== undefined) payroll.bonus = Math.max(0, parseFloat(bonus) || 0);
    if (deductions !== undefined) payroll.deductions = Math.max(0, parseFloat(deductions) || 0);
    if (notes !== undefined) payroll.notes = notes;

    // Recalculate net salary
    payroll.netSalary = payroll.baseSalary + payroll.bonus - payroll.deductions;

    await payroll.save();
    await payroll.populate('staffId', 'firstName lastName email department baseSalary');

    if (req.io) {
      req.io.emit('payroll:updated', {
        payrollId: payroll._id,
        bonus: payroll.bonus,
        deductions: payroll.deductions,
        netSalary: payroll.netSalary,
      });
    }

    res.json({ message: 'Payroll updated successfully', payroll });
  } catch (error) {
    console.error('updatePayroll error:', error);
    res.status(500).json({ message: 'Failed to update payroll', error: error.message });
  }
};

// ── Soft delete payroll (row) ─────────────────────────────────────────────────
const deletePayroll = async (req, res) => {
  try {
    const { payrollId } = req.params;

    const payroll = await Payroll.findById(payrollId);
    if (!payroll) {
      return res.status(404).json({ message: 'Payroll entry not found' });
    }

    if (payroll.deleted) {
      return res.status(400).json({ message: 'Payroll entry is already deleted' });
    }

    if (payroll.isPaid) {
      return res.status(400).json({
        message: 'Cannot delete a payroll entry that has already been paid',
      });
    }

    const { staffId, month } = payroll;
    await Payroll.findByIdAndDelete(payrollId);

    if (req.io) {
      req.io.emit('payroll:deleted', { payrollId, staffId, month });
    }

    res.json({ message: 'Payroll deleted successfully', payrollId });
  } catch (error) {
    console.error('deletePayroll error:', error);
    res.status(500).json({ message: 'Failed to delete payroll', error: error.message });
  }
};

// ─── Mark batch payroll as paid ───────────────────────────────────────────────
const markBatchPayrollAsPaid = async (req, res) => {
  try {
    const { payrollIds, notes } = req.body;

    if (!Array.isArray(payrollIds) || payrollIds.length === 0) {
      return res.status(400).json({ message: 'payrollIds must be a non-empty array' });
    }

    const result = await Payroll.updateMany(
      { _id: { $in: payrollIds }, isPaid: false },
      {
        $set: {
          isPaid: true,
          paidAt: new Date(),
          paidBy: req.user._id,
          ...(notes && { notes }),
        },
      }
    );

    const updatedPayrolls = await Payroll.find({ _id: { $in: payrollIds } })
      .populate('staffId', 'firstName lastName')
      .populate('paidBy', 'firstName lastName');

    const totalPaid = updatedPayrolls.reduce((sum, p) => sum + p.netSalary, 0);

    if (req.io) {
      req.io.emit('payroll:batchPaid', {
        count: result.modifiedCount,
        totalPaid,
        paidAt: new Date(),
      });
    }

    res.json({
      message: `${result.modifiedCount} payroll entries marked as paid`,
      modifiedCount: result.modifiedCount,
      totalPaid,
      payrolls: updatedPayrolls,
    });
  } catch (error) {
    console.error('markBatchPayrollAsPaid error:', error);
    res.status(500).json({ message: 'Failed to mark batch payroll as paid', error: error.message });
  }
};

// ─── Get payroll statistics ───────────────────────────────────────────────────
const getPayrollStats = async (req, res) => {
  try {
    const { startMonth, endMonth } = req.query;

    const monthFilter = {};
    if (startMonth || endMonth) {
      monthFilter.month = {};
      if (startMonth) monthFilter.month.$gte = startMonth;
      if (endMonth) monthFilter.month.$lte = endMonth;
    }

    const [totalPayroll, monthlyBreakdown, topEarners] = await Promise.all([
      Payroll.aggregate([
        { $match: monthFilter },
        {
          $group: {
            _id: null,
            totalBaseSalary: { $sum: '$baseSalary' },
            totalBonus: { $sum: '$bonus' },
            totalDeductions: { $sum: '$deductions' },
            totalNetSalary: { $sum: '$netSalary' },
            paidCount: { $sum: { $cond: ['$isPaid', 1, 0] } },
            pendingCount: { $sum: { $cond: ['$isPaid', 0, 1] } },
          },
        },
      ]),

      Payroll.aggregate([
        { $match: monthFilter },
        {
          $group: {
            _id: '$month',
            totalNetSalary: { $sum: '$netSalary' },
            staffCount: { $sum: 1 },
            paidCount: { $sum: { $cond: ['$isPaid', 1, 0] } },
          },
        },
        { $sort: { _id: -1 } },
      ]),

      Payroll.aggregate([
        { $match: monthFilter },
        {
          $group: {
            _id: '$staffId',
            totalEarnings: { $sum: '$netSalary' },
          },
        },
        { $sort: { totalEarnings: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'staff',
          },
        },
        { $unwind: { path: '$staff', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            totalEarnings: 1,
            'staff.firstName': 1,
            'staff.lastName': 1,
            'staff.department': 1,
          },
        },
      ]),
    ]);

    res.json({
      period: {
        startMonth: startMonth || 'All time',
        endMonth: endMonth || 'Present',
      },
      totalPayroll: totalPayroll[0] || {
        totalBaseSalary: 0,
        totalBonus: 0,
        totalDeductions: 0,
        totalNetSalary: 0,
        paidCount: 0,
        pendingCount: 0,
      },
      monthlyBreakdown,
      topEarners,
    });
  } catch (error) {
    console.error('getPayrollStats error:', error);
    res.status(500).json({ message: 'Failed to fetch payroll stats', error: error.message });
  }
};

// HR submits draft payroll to manager for approval
const submitPayrollForApproval = async (req, res) => {
  try {
    const { payrollId } = req.params;
    const payroll = await Payroll.findById(payrollId);

    if (!payroll) return res.status(404).json({ message: 'Payroll not found' });

    if (payroll.approvalStatus !== PAYROLL_STATUS.DRAFT) {
      return res.status(400).json({
        message: `Cannot submit — payroll is already ${payroll.approvalStatus}`,
      });
    }

    payroll.approvalStatus = PAYROLL_STATUS.PENDING;
    await payroll.save();

    res.json({ message: 'Payroll submitted for manager approval', payroll });
  } catch (error) {
    res.status(500).json({ message: 'Failed to submit payroll', error: error.message });
  }
};

// Manager approves payroll — makes it visible to Accountant for payment
const approvePayroll = async (req, res) => {
  try {
    const { payrollId } = req.params;
    const payroll = await Payroll.findById(payrollId);

    if (!payroll) return res.status(404).json({ message: 'Payroll not found' });

    if (payroll.approvalStatus !== PAYROLL_STATUS.PENDING) {
      return res.status(400).json({
        message: `Cannot approve — payroll status is ${payroll.approvalStatus}`,
      });
    }

    payroll.approvalStatus = PAYROLL_STATUS.APPROVED;
    payroll.approvedBy     = req.user._id;
    payroll.approvedAt     = new Date();
    await payroll.save();
    createNotification(req.io, {
  title:        'Payroll Approved',
  message:      `Payroll entry has been approved and is ready for payment.`,
  type:         'PAYROLL_APPROVED',
  targetRoles:  ['SUPER_ADMIN', 'ACCOUNTANT', 'HR'],
  resourceId:   payroll._id,
  resourceType: 'Payroll',
});

    res.json({ message: 'Payroll approved', payroll });
  } catch (error) {
    res.status(500).json({ message: 'Failed to approve payroll', error: error.message });
  }
};

// Manager rejects payroll — sends back to HR with a reason
const rejectPayroll = async (req, res) => {
  try {
    const { payrollId } = req.params;
    const { reason }    = req.body;
    const payroll       = await Payroll.findById(payrollId);

    if (!payroll) return res.status(404).json({ message: 'Payroll not found' });

    if (payroll.approvalStatus !== PAYROLL_STATUS.PENDING) {
      return res.status(400).json({
        message: `Cannot reject — payroll status is ${payroll.approvalStatus}`,
      });
    }

    payroll.approvalStatus  = PAYROLL_STATUS.REJECTED;
    payroll.approvedBy      = req.user._id;
    payroll.rejectedReason  = reason || 'No reason provided';
    await payroll.save();

    createNotification(req.io, {
  title:        'Payroll Rejected',
  message:      `Payroll entry was rejected: ${reason || 'No reason given'}.`,
  type:         'PAYROLL_REJECTED',
  targetRoles:  ['SUPER_ADMIN', 'HR'],
  resourceId:   payroll._id,
  resourceType: 'Payroll',
});

    res.json({ message: 'Payroll rejected', payroll });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reject payroll', error: error.message });
  }
};

// Override markPayrollAsPaid to only allow APPROVED payrolls
const markPayrollAsPaidSafe = async (req, res) => {
  try {
    const { payrollId } = req.params;
    const { notes }     = req.body;
    const payroll       = await Payroll.findById(payrollId);

    if (!payroll) return res.status(404).json({ message: 'Payroll not found' });

    if (payroll.approvalStatus !== PAYROLL_STATUS.APPROVED) {
      return res.status(400).json({
        message: `Cannot pay — payroll must be APPROVED first (current: ${payroll.approvalStatus})`,
      });
    }

    if (payroll.isPaid) {
      return res.status(400).json({ message: 'Payroll already paid' });
    }

    payroll.isPaid         = true;
    payroll.paidAt         = new Date();
    payroll.paidBy         = req.user._id;
    payroll.approvalStatus = PAYROLL_STATUS.PAID;
    if (notes) payroll.notes = notes;
    await payroll.save();

    await payroll.populate('staffId', 'firstName lastName email');
    await payroll.populate('paidBy', 'firstName lastName');

    if (req.io) {
      req.io.emit('payroll:paid', {
        payrollId: payroll._id,
        staffId: payroll.staffId._id,
        netSalary: payroll.netSalary,
        paidAt: payroll.paidAt,
      });
    }

    res.json({ message: 'Payroll marked as paid', payroll });
  } catch (error) {
    res.status(500).json({ message: 'Failed to mark payroll as paid', error: error.message });
  }
};

module.exports = {
  createMonthlyPayroll,
  getPayrollWorkers,
  getPayrollByMonth,
  getAllPayroll,
  getPayrollById,
  updatePayroll,
  deletePayroll,
  markPayrollAsPaid: markPayrollAsPaidSafe, // Maps the safe logic to the old name!
  markBatchPayrollAsPaid,
  getPayrollStats,
  submitPayrollForApproval,
  approvePayroll,
  rejectPayroll,
};