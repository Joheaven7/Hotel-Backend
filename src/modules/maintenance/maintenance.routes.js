const express = require('express');
const maintenanceController = require('./maintenance.controller');
const authMiddleware = require('../../middlewares/auth');
const { requirePermission } = require('../../middlewares/permissionCheck');
const { PERMISSIONS } = require('../../config/constants');
const { auditLogger } = require('../../middlewares/auditLogger');

const router = express.Router();
router.use(authMiddleware);

// Create
router.post(
  '/',
  requirePermission(PERMISSIONS.MAINTENANCE.CREATE),
  auditLogger('MAINTENANCE_CREATE'),
  maintenanceController.createMaintenance
);

// Get all
router.get('/', maintenanceController.getAllMaintenance);

// Stats report
router.get(
  '/stats/report',
  requirePermission(PERMISSIONS.MAINTENANCE.VIEW),
  maintenanceController.getMaintenanceStats
);

// By room
router.get('/room/:roomId', maintenanceController.getMaintenanceByRoom);

// Single
router.get('/:maintenanceId', maintenanceController.getMaintenanceById);

// Assign
router.post(
  '/:maintenanceId/assign',
  requirePermission(PERMISSIONS.MAINTENANCE.UPDATE),
  auditLogger('MAINTENANCE_UPDATE'),
  maintenanceController.assignMaintenance
);

// Update status — PUT
router.put(
  '/:maintenanceId',
  requirePermission(PERMISSIONS.MAINTENANCE.UPDATE),
  auditLogger('MAINTENANCE_UPDATE'),
  maintenanceController.updateMaintenanceStatus
);

// Update status — PATCH (backwards compatibility)
router.patch(
  '/:maintenanceId/status',
  requirePermission(PERMISSIONS.MAINTENANCE.UPDATE),
  auditLogger('MAINTENANCE_UPDATE'),
  maintenanceController.updateMaintenanceStatus
);

// Delete
router.delete(
  '/:maintenanceId',
  requirePermission(PERMISSIONS.MAINTENANCE.RESOLVE),
  auditLogger('MAINTENANCE_DELETE'),
  maintenanceController.deleteMaintenance
);

module.exports = router;