const express = require('express');
const dashboardController = require('./dashboard.controller');
const authMiddleware = require('../../middlewares/auth');
const { roleCheck } = require('../../middlewares/roleCheck');
const { ROLES } = require('../../config/constants');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get dashboard - auto-routes based on role (each role sees their own data)
router.get('/', dashboardController.getDashboard);

// Advanced analytics - SUPER_ADMIN and ADMIN only
router.get(
  '/analytics',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  dashboardController.getAdvancedAnalytics
);

// Per-role explicit routes (for direct access if needed)
router.get('/superadmin', roleCheck(ROLES.SUPER_ADMIN), dashboardController.superAdminDashboard);
router.get('/admin', roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN), dashboardController.adminDashboard);
router.get('/accountant', roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTANT), dashboardController.accountantDashboard);
router.get('/staff', roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF), dashboardController.staffDashboard);
router.get('/customer', roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.CUSTOMER), dashboardController.customerDashboard);

module.exports = router;