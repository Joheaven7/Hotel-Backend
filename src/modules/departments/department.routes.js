const express = require('express');
const router = express.Router();
const departmentController = require('./department.controller');
const authMiddleware = require('../../middlewares/auth');
const { requirePermission } = require('../../middlewares/permissionCheck');
const { PERMISSIONS } = require('../../config/constants');

router.use(authMiddleware);

// Publicly viewable to all staff/users within management system
router.get('/', departmentController.getAllDepartments);
router.get('/:id/users', departmentController.getDepartmentUsers);

// Modifying departments
router.post('/', requirePermission(PERMISSIONS.SYSTEM.SETTINGS), departmentController.createDepartment);
router.patch('/:id', requirePermission(PERMISSIONS.SYSTEM.SETTINGS), departmentController.updateDepartment);
router.delete('/:id', requirePermission(PERMISSIONS.SYSTEM.SETTINGS), departmentController.deleteDepartment);

module.exports = router;

