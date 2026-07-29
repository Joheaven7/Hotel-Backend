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
const { requirePermission } = require('../../middlewares/permissionCheck');
const { auditLogger } = require('../../middlewares/auditLogger');
const { PERMISSIONS } = require('../../config/constants');

const router = express.Router();

// Public payment verification
router.post('/public/verify', verifyChapaPayment);

// All routes below require authentication
router.use(authMiddleware);

// Chapa payment initiation and verification - any authenticated user
router.post('/chapa/initiate', initiateChapaPayment);
router.post('/chapa/verify', verifyChapaPayment);
router.post('/intent/create', createPaymentIntent);
router.post('/intent/finalize', finalizePaymentIntent);

// Get all payments (CUSTOMER sees their own — filtered in controller)
router.get(
  '/',
  requirePermission(PERMISSIONS.PAYMENTS.VIEW),
  getAllPayments
);

// Payment stats
router.get(
  '/stats/overview',
  requirePermission(PERMISSIONS.PAYMENTS.VIEW),
  getPaymentStats
);

// Get single payment - any authenticated user (controller handles ownership for CUSTOMER)
router.get('/:id', getPaymentById);

// Mark as paid
router.put(
  '/:id/paid',
  requirePermission(PERMISSIONS.PAYMENTS.APPROVE),
  auditLogger('PAYMENT_PROCESS'),
  markPaymentAsPaid
);

// Mark as failed
router.put(
  '/:id/failed',
  requirePermission(PERMISSIONS.PAYMENTS.APPROVE),
  markPaymentAsFailed
);

module.exports = router;