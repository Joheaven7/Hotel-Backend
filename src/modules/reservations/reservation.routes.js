const express = require('express');
const reservationController = require('./reservation.controller');
const authMiddleware = require('../../middlewares/auth');
const { roleCheck } = require('../../middlewares/roleCheck');
const { ROLES } = require('../../config/constants');
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


router.post(
  '/:reservationId/confirm',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER),
  auditLogger('RESERVATION_CONFIRM'),
  reservationController.confirmReservation
);

// Check-in — ADMIN/STAFF
router.post(
  '/:reservationId/check-in',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF),
  auditLogger('RESERVATION_CHECKIN'),
  reservationController.checkInReservation
);
router.post(
  '/:reservationId/checkin',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF),
  auditLogger('RESERVATION_CHECKIN'),
  reservationController.checkInReservation
);

// Check-out — ADMIN/STAFF
router.post(
  '/:reservationId/check-out',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF),
  auditLogger('RESERVATION_CHECKOUT'),
  reservationController.checkOutReservation
);
router.post(
  '/:reservationId/checkout',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF),
  auditLogger('RESERVATION_CHECKOUT'),
  reservationController.checkOutReservation
);

// Cancel — owner or ADMIN+ (ownership check in controller)
router.post(
  '/:reservationId/cancel',
  auditLogger('RESERVATION_CANCEL'),
  reservationController.cancelReservation
);

// Soft delete — SUPER_ADMIN only
router.delete(
  '/:reservationId',
  roleCheck(ROLES.SUPER_ADMIN),
  auditLogger('RESERVATION_DELETE'),
  reservationController.deleteReservation
);

// Undo soft delete — SUPER_ADMIN only
router.post(
  '/:reservationId/undo-delete',
  roleCheck(ROLES.SUPER_ADMIN),
  auditLogger('RESERVATION_RESTORE'),
  reservationController.undoDeleteReservation
);

module.exports = router;