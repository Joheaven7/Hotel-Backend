const express = require('express');
const router = express.Router();
const roleController = require('./role.controller');
const authMiddleware = require('../../middlewares/auth');
const { requirePermission } = require('../../middlewares/permissionCheck');
const { PERMISSIONS } = require('../../config/constants');

router.use(authMiddleware);

// Viewable within management system
router.get('/', requirePermission(PERMISSIONS.USERS.MANAGE_PERMISSIONS), roleController.getAllRoles);

// Only SUPER_ADMIN (or users with managePermissions) can modify roles
router.post('/', requirePermission(PERMISSIONS.USERS.MANAGE_PERMISSIONS), roleController.createRole);
router.patch('/:id', requirePermission(PERMISSIONS.USERS.MANAGE_PERMISSIONS), roleController.updateRole);
router.post('/:id/clone', requirePermission(PERMISSIONS.USERS.MANAGE_PERMISSIONS), roleController.cloneRole);
router.delete('/:id', requirePermission(PERMISSIONS.USERS.MANAGE_PERMISSIONS), roleController.deleteRole);

module.exports = router;
