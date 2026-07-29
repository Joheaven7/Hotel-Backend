const express = require('express');
const userController = require('./user.controller');
const authMiddleware = require('../../middlewares/auth');
const { requirePermission } = require('../../middlewares/permissionCheck');
const { PERMISSIONS } = require('../../config/constants');
const { validateUserCreation, handleValidationErrors } = require('../../utils/validators');
const { auditLogger } = require('../../middlewares/auditLogger');

const router = express.Router();
router.use(authMiddleware);

// Create user
router.post(
  '/',
  requirePermission(PERMISSIONS.USERS.CREATE),
  validateUserCreation,
  handleValidationErrors,
  auditLogger('USER_CREATE'),
  userController.createUser
);

// Get all users
router.get(
  '/',
  requirePermission(PERMISSIONS.USERS.VIEW),
  userController.getAllUsers
);

// Get single user (any authenticated user; controller enforces ownership/hierarchy)
router.get('/:userId', userController.getUserById);

// Update user (self-update allowed for all; controller enforces hierarchy for editing others)
router.patch(
  '/:userId',
  auditLogger('USER_UPDATE'),
  userController.updateUser
);

// Delete (soft)
router.delete(
  '/:userId',
  requirePermission(PERMISSIONS.USERS.DELETE),
  auditLogger('USER_DELETE'),
  userController.deleteUser
);

// Restore
router.post(
  '/:userId/restore',
  requirePermission(PERMISSIONS.SYSTEM.RESTORE_DATA),
  auditLogger('USER_RESTORE'),
  userController.restoreUser
);

// Assign role
router.post(
  '/:userId/assign-role',
  requirePermission(PERMISSIONS.USERS.ASSIGN_ROLES),
  auditLogger('ROLE_CHANGE'),
  userController.assignRole
);

// Update user permissions
router.put(
  '/:userId/permissions',
  requirePermission(PERMISSIONS.USERS.MANAGE_PERMISSIONS),
  auditLogger('PERMISSION_CHANGE'),
  userController.updateUserPermissions
);

module.exports = router;