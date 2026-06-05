const express = require('express');
const {
  initiateChapaPayment,
  verifyChapaPayment,
  createPaymentIntent,
  finalizePaymentIntent,
  getAllPayments,
  getPaymentById,
  markPaymentAsPaid,
  markPaymentAsFailed,
  getPaymentStats,
} = require('./payment.controller');
const authMiddleware = require('../../middlewares/auth');
const { roleCheck } = require('../../middlewares/roleCheck');
const { auditLogger } = require('../../middlewares/auditLogger');
const { ROLES } = require('../../config/constants');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Chapa payment initiation and verification - any authenticated user
router.post('/chapa/initiate', initiateChapaPayment);
router.post('/chapa/verify', verifyChapaPayment);
router.post('/intent/create', createPaymentIntent);
router.post('/intent/finalize', finalizePaymentIntent);

// Get all payments - SUPER_ADMIN, ADMIN, ACCOUNTANT see all; CUSTOMER sees their own (filtered in controller)
router.get(
  '/',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.CUSTOMER),
  getAllPayments
);

// Payment stats - admin/accountant only
router.get(
  '/stats/overview',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT),
  getPaymentStats
);

// Get single payment - any authenticated user (controller handles ownership for CUSTOMER)
router.get('/:id', getPaymentById);

// Mark as paid/failed - admin/accountant only
router.put(
  '/:id/paid',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT),
  auditLogger('PAYMENT_PROCESS'),
  markPaymentAsPaid
);

router.put(
  '/:id/failed',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT),
  markPaymentAsFailed
);

module.exports = router;