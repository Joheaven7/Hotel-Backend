const express = require('express');
const router = express.Router();
const permissionController = require('./permission.controller');
const authMiddleware = require('../../middlewares/auth');
const { requirePermission } = require('../../middlewares/permissionCheck');
const { PERMISSIONS } = require('../../config/constants');

router.use(authMiddleware);

// Viewable within management system
router.get('/', requirePermission(PERMISSIONS.USERS.MANAGE_PERMISSIONS), permissionController.getAllPermissions);

// Only SUPER_ADMIN (or users with managePermissions) can modify permissions
router.post('/', requirePermission(PERMISSIONS.USERS.MANAGE_PERMISSIONS), permissionController.createPermission);
router.patch('/:id', requirePermission(PERMISSIONS.USERS.MANAGE_PERMISSIONS), permissionController.updatePermission);
router.delete('/:id', requirePermission(PERMISSIONS.USERS.MANAGE_PERMISSIONS), permissionController.deletePermission);

module.exports = router;

