const express = require('express');
const payrollController = require('./payroll.controller');
const authMiddleware    = require('../../middlewares/auth');
const { roleCheck }     = require('../../middlewares/roleCheck');
const { ROLES }         = require('../../config/constants');
const { auditLogger }   = require('../../middlewares/auditLogger');

const router = express.Router();
router.use(authMiddleware);

// ── Create monthly payroll draft — HR, ADMIN, SUPER_ADMIN ──────────────────────
router.post(
  '/monthly/create',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR),
  auditLogger('PAYROLL_CREATE'),
  payrollController.createMonthlyPayroll
);

// ── HR: submit draft for manager approval ─────────────────────────────────────
router.post(
  '/:payrollId/submit',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR),
  auditLogger('PAYROLL_CREATE'),
  payrollController.submitPayrollForApproval
);

// ── Manager: approve payroll ──────────────────────────────────────────────────
router.post(
  '/:payrollId/approve',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER),
  auditLogger('PAYROLL_PAID'),
  payrollController.approvePayroll
);

// ── Manager: reject payroll ───────────────────────────────────────────────────
router.post(
  '/:payrollId/reject',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER),
  payrollController.rejectPayroll
);

// ── Batch mark paid ───────────────────────────────────────────────────────────
router.post(
  '/batch/mark-paid',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT),
  auditLogger('PAYROLL_PAID'),
  payrollController.markBatchPayrollAsPaid
);

// ── Worker directory ───────────────────────────────────────────────────────────
router.get(
  '/workers',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.HR, ROLES.ACCOUNTANT),
  payrollController.getPayrollWorkers
);

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get(
  '/stats/report',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.HR, ROLES.ACCOUNTANT),
  payrollController.getPayrollStats
);

// ── Get by month ──────────────────────────────────────────────────────────────
router.get(
  '/month/:month',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.HR, ROLES.ACCOUNTANT),
  payrollController.getPayrollByMonth
);

// ── Get single ────────────────────────────────────────────────────────────────
router.get(
  '/:payrollId',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.HR, ROLES.ACCOUNTANT),
  payrollController.getPayrollById
);

// ── Accountant: mark as paid (APPROVED only — enforced in controller) ─────────
router.post(
  '/:payrollId/mark-paid',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ACCOUNTANT),
  auditLogger('PAYROLL_PAID'),
  payrollController.markPayrollAsPaid
);

// ── Update bonus/deductions — HR, ADMIN (only on DRAFT or REJECTED) ───────────
router.put(
  '/:payrollId',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR),
  auditLogger('PAYROLL_CREATE'),
  payrollController.updatePayroll
);

// ── Delete — ADMIN / MANAGER ─────────────────────────────────────────────────
router.delete(
  '/:payrollId',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER),
  payrollController.deletePayroll
);

module.exports = router;