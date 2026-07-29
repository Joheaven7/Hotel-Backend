const express = require('express');
const reservationController = require('./reservation.controller');
const authMiddleware = require('../../middlewares/auth');
const { requirePermission } = require('../../middlewares/permissionCheck');
const { PERMISSIONS } = require('../../config/constants');
const { validateReservation, handleValidationErrors } = require('../../utils/validators');
const { createRateLimiter } = require('../../middlewares/rateLimiter');
const { auditLogger } = require('../../middlewares/auditLogger');

const router = express.Router();

const bookingLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 10,
  message: 'Too many reservation requests. Please try again in 5 minutes.',
});

// Get reviews (public route)
router.get('/reviews', reservationController.getReviews);

// Public Booking - Does not require authentication
router.post(
  '/public',
  bookingLimiter,
  validateReservation,
  handleValidationErrors,
  reservationController.createPublicReservation
);

router.use(authMiddleware);

// Create reservation
router.post(
  '/',
  bookingLimiter,
  validateReservation,
  handleValidationErrors,
  auditLogger('RESERVATION_CREATE'),
  reservationController.createReservation
);

// Get all reservations (role-filtered in controller)
router.get('/', reservationController.getAllReservations);

// Availability calendar
router.get('/calendar/availability', reservationController.getAvailabilityCalendar);

// Get single reservation
router.get('/:reservationId', reservationController.getReservationById);

// Confirm
router.post(
  '/:reservationId/confirm',
  requirePermission(PERMISSIONS.RESERVATIONS.APPROVE),
  auditLogger('RESERVATION_CONFIRM'),
  reservationController.confirmReservation
);

// Check-in
router.post(
  '/:reservationId/check-in',
  requirePermission(PERMISSIONS.RESERVATIONS.EDIT),
  auditLogger('RESERVATION_CHECKIN'),
  reservationController.checkInReservation
);
router.post(
  '/:reservationId/checkin',
  requirePermission(PERMISSIONS.RESERVATIONS.EDIT),
  auditLogger('RESERVATION_CHECKIN'),
  reservationController.checkInReservation
);

// Check-out
router.post(
  '/:reservationId/check-out',
  requirePermission(PERMISSIONS.RESERVATIONS.EDIT),
  auditLogger('RESERVATION_CHECKOUT'),
  reservationController.checkOutReservation
);
router.post(
  '/:reservationId/checkout',
  requirePermission(PERMISSIONS.RESERVATIONS.EDIT),
  auditLogger('RESERVATION_CHECKOUT'),
  reservationController.checkOutReservation
);

// Cancel — ownership check in controller allows customers to cancel their own
router.post(
  '/:reservationId/cancel',
  auditLogger('RESERVATION_CANCEL'),
  reservationController.cancelReservation
);

// Soft delete
router.delete(
  '/:reservationId',
  requirePermission(PERMISSIONS.SYSTEM.RESTORE_DATA),
  auditLogger('RESERVATION_DELETE'),
  reservationController.deleteReservation
);

// Undo soft delete
router.post(
  '/:reservationId/undo-delete',
  requirePermission(PERMISSIONS.SYSTEM.RESTORE_DATA),
  auditLogger('RESERVATION_RESTORE'),
  reservationController.undoDeleteReservation
);

module.exports = router;