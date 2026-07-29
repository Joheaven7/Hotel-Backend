const express = require('express');
const payrollController = require('./payroll.controller');
const authMiddleware    = require('../../middlewares/auth');
const { requirePermission } = require('../../middlewares/permissionCheck');
const { PERMISSIONS }   = require('../../config/constants');
const { auditLogger }   = require('../../middlewares/auditLogger');

const router = express.Router();
router.use(authMiddleware);

// ── Create monthly payroll draft ────────────────────────────────────────────────
router.post(
  '/monthly/create',
  requirePermission(PERMISSIONS.PAYROLL.CREATE),
  auditLogger('PAYROLL_CREATE'),
  payrollController.createMonthlyPayroll
);

// ── Submit draft for manager approval ───────────────────────────────────────────
router.post(
  '/:payrollId/submit',
  requirePermission(PERMISSIONS.PAYROLL.CREATE),
  auditLogger('PAYROLL_CREATE'),
  payrollController.submitPayrollForApproval
);

// ── Approve payroll ─────────────────────────────────────────────────────────────
router.post(
  '/:payrollId/approve',
  requirePermission(PERMISSIONS.PAYROLL.APPROVE),
  auditLogger('PAYROLL_PAID'),
  payrollController.approvePayroll
);

// ── Reject payroll ──────────────────────────────────────────────────────────────
router.post(
  '/:payrollId/reject',
  requirePermission(PERMISSIONS.PAYROLL.APPROVE),
  payrollController.rejectPayroll
);

// ── Batch mark paid ─────────────────────────────────────────────────────────────
router.post(
  '/batch/mark-paid',
  requirePermission(PERMISSIONS.PAYMENTS.APPROVE),
  auditLogger('PAYROLL_PAID'),
  payrollController.markBatchPayrollAsPaid
);

// ── Worker directory ────────────────────────────────────────────────────────────
router.get(
  '/workers',
  requirePermission(PERMISSIONS.PAYROLL.VIEW),
  payrollController.getPayrollWorkers
);

// ── Stats ───────────────────────────────────────────────────────────────────────
router.get(
  '/stats/report',
  requirePermission(PERMISSIONS.PAYROLL.VIEW),
  payrollController.getPayrollStats
);

// ── Get by month ────────────────────────────────────────────────────────────────
router.get(
  '/month/:month',
  requirePermission(PERMISSIONS.PAYROLL.VIEW),
  payrollController.getPayrollByMonth
);

// ── Get single ──────────────────────────────────────────────────────────────────
router.get(
  '/:payrollId',
  requirePermission(PERMISSIONS.PAYROLL.VIEW),
  payrollController.getPayrollById
);

// ── Mark as paid (APPROVED only — enforced in controller) ───────────────────────
router.post(
  '/:payrollId/mark-paid',
  requirePermission(PERMISSIONS.PAYMENTS.APPROVE),
  auditLogger('PAYROLL_PAID'),
  payrollController.markPayrollAsPaid
);

// ── Update bonus/deductions (only on DRAFT or REJECTED) ─────────────────────────
router.put(
  '/:payrollId',
  requirePermission(PERMISSIONS.PAYROLL.EDIT),
  auditLogger('PAYROLL_CREATE'),
  payrollController.updatePayroll
);

// ── Delete ───────────────────────────────────────────────────────────────────────
router.delete(
  '/:payrollId',
  requirePermission(PERMISSIONS.PAYROLL.DELETE),
  payrollController.deletePayroll
);

module.exports = router;