const express = require('express');
const dashboardController = require('./dashboard.controller');
const authMiddleware = require('../../middlewares/auth');
const { requirePermission } = require('../../middlewares/permissionCheck');
const { PERMISSIONS } = require('../../config/constants');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get dashboard - auto-routes based on role (each role sees their own data)
router.get('/', dashboardController.getDashboard);

// Advanced analytics
router.get(
  '/analytics',
  requirePermission(PERMISSIONS.DASHBOARD.VIEW_ANALYTICS),
  dashboardController.getAdvancedAnalytics
);

// Per-role explicit routes (for direct access if needed)
router.get('/superadmin', requirePermission(PERMISSIONS.DASHBOARD.VIEW), dashboardController.superAdminDashboard);
router.get('/admin', requirePermission(PERMISSIONS.DASHBOARD.VIEW), dashboardController.adminDashboard);
router.get('/accountant', requirePermission(PERMISSIONS.DASHBOARD.VIEW), dashboardController.accountantDashboard);
router.get('/staff', requirePermission(PERMISSIONS.DASHBOARD.VIEW), dashboardController.staffDashboard);
router.get('/customer', requirePermission(PERMISSIONS.DASHBOARD.VIEW), dashboardController.customerDashboard);

module.exports = router;