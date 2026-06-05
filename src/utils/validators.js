const { body, validationResult } = require('express-validator');

// Reservation: roomId OR hallId — one must be present, not both required
const validateReservation = [
  body('checkInDate')
    .isISO8601()
    .withMessage('Valid checkInDate is required'),
  body('checkOutDate')
    .isISO8601()
    .withMessage('Valid checkOutDate is required'),
  body('numberOfGuests')
    .isInt({ min: 1 })
    .withMessage('At least 1 guest is required'),
  body().custom((value) => {
    if (!value.roomTypeId && !value.hallTypeId) {
      throw new Error('Either roomTypeId or hallTypeId is required');
    }
    return true;
  }),
];

const validatePaymentCreation = [
  body('reservationId').notEmpty().withMessage('Reservation ID required'),
  body('amount').isFloat({ min: 0 }).withMessage('Valid amount required'),
];

const validatePaymentIntent = [
  body('reservationId').notEmpty().withMessage('Reservation ID is required'),
  body('amount').isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
  body('customerEmail').isEmail().withMessage('Valid customer email is required'),
  body('customerName').notEmpty().withMessage('Customer name is required'),
];

const validateUserCreation = [
  body('firstName').notEmpty().withMessage('First name required'),
  body('lastName').notEmpty().withMessage('Last name required'),
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be 6+ chars'),
  body('role')
    .notEmpty()
    .withMessage('Role required')
    .isIn(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'HR', 'ACCOUNTANT', 'STAFF', 'CUSTOMER'])
    .withMessage('Invalid role'),
];

const validateRegistration = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body().custom((value) => {
    if (!value.firstName && !value.name) {
      throw new Error('Name is required');
    }
    return true;
  }),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: errors.array()[0].msg,
      errors: errors.array(),
    });
  }
  next();
};

module.exports = {
  validateReservation,
  validatePaymentCreation,
  validateUserCreation,
  validateRegistration,
  handleValidationErrors,
};