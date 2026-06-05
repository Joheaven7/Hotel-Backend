const express = require('express');
const userController = require('./user.controller');
const authMiddleware = require('../../middlewares/auth');
const { roleCheck } = require('../../middlewares/roleCheck');
const { ROLES } = require('../../config/constants');
const { validateUserCreation, handleValidationErrors } = require('../../utils/validators');
const { auditLogger } = require('../../middlewares/auditLogger');

const router = express.Router();
router.use(authMiddleware);

// Create user — SUPER_ADMIN, ADMIN, MANAGER (HR can also create STAFF)
router.post(
  '/',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.HR),
  validateUserCreation,
  handleValidationErrors,
  auditLogger('USER_CREATE'),
  userController.createUser
);

// Get all users — SUPER_ADMIN, ADMIN, MANAGER, HR, ACCOUNTANT
router.get(
  '/',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.HR, ROLES.ACCOUNTANT),
  userController.getAllUsers
);

// Get single user
router.get('/:userId', userController.getUserById);

// Update user — managers can update staff below them
router.patch(
  '/:userId',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.HR, ROLES.ACCOUNTANT, ROLES.STAFF, ROLES.CUSTOMER),
  auditLogger('USER_UPDATE'),
  userController.updateUser
);

// Delete (soft) — SUPER_ADMIN, ADMIN, MANAGER
router.delete(
  '/:userId',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER),
  auditLogger('USER_DELETE'),
  userController.deleteUser
);

// Restore — SUPER_ADMIN, ADMIN only
router.post(
  '/:userId/restore',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  auditLogger('USER_RESTORE'),
  userController.restoreUser
);

// Assign role — SUPER_ADMIN only
router.post(
  '/:userId/assign-role',
  roleCheck(ROLES.SUPER_ADMIN),
  auditLogger('ROLE_CHANGE'),
  userController.assignRole
);

module.exports = router;