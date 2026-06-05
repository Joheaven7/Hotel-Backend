const express = require('express');
const maintenanceController = require('./maintenance.controller');
const authMiddleware = require('../../middlewares/auth');
const { roleCheck } = require('../../middlewares/roleCheck');
const { ROLES } = require('../../config/constants');
const { auditLogger } = require('../../middlewares/auditLogger');

const router = express.Router();
router.use(authMiddleware);

// Create — ADMIN/STAFF only
router.post(
  '/',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF),
  auditLogger('MAINTENANCE_CREATE'),
  maintenanceController.createMaintenance
);

// Get all
router.get('/', maintenanceController.getAllMaintenance);

// Stats report — ADMIN+ only
router.get(
  '/stats/report',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  maintenanceController.getMaintenanceStats
);

// By room
router.get('/room/:roomId', maintenanceController.getMaintenanceByRoom);

// Single
router.get('/:maintenanceId', maintenanceController.getMaintenanceById);

// Assign — ADMIN+ only
router.post(
  '/:maintenanceId/assign',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  auditLogger('MAINTENANCE_UPDATE'),
  maintenanceController.assignMaintenance
);

// ✅ UPDATE STATUS — BOTH PUT and PATCH (frontend uses PUT)
router.put(
  '/:maintenanceId',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF),
  auditLogger('MAINTENANCE_UPDATE'),
  maintenanceController.updateMaintenanceStatus
);

// Also keep PATCH for backwards compatibility
router.patch(
  '/:maintenanceId/status',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF),
  auditLogger('MAINTENANCE_UPDATE'),
  maintenanceController.updateMaintenanceStatus
);

// ✅ DELETE — ADMIN+ only (was missing!)
router.delete(
  '/:maintenanceId',
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  auditLogger('MAINTENANCE_DELETE'),
  maintenanceController.deleteMaintenance
);

module.exports = router;