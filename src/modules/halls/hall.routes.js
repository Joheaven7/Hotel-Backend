const express = require('express');
const hallController = require('./hall.controller');
const authMiddleware = require('../../middlewares/auth');
const { requirePermission } = require('../../middlewares/permissionCheck');
const { PERMISSIONS } = require('../../config/constants');
const { auditLogger } = require('../../middlewares/auditLogger');

const router = express.Router();

// ── Public ─────────────────────────────────────────────────────────────────────
router.get('/', hallController.getAllHalls);

// Public catalog — explicit path before /:hallId
router.get(
  '/public-catalog',
  authMiddleware,
  requirePermission(PERMISSIONS.HALLS.VIEW),
  hallController.getPublicLandingHalls
);

// Single hall — public
router.get('/:hallId', hallController.getHallById);

// ── Protected ─────────────────────────────────────────────────────────────────
// Create
router.post(
  '/',
  authMiddleware,
  requirePermission(PERMISSIONS.HALLS.CREATE),
  auditLogger('HALL_CRUD'),
  hallController.createHall
);

// Update
router.patch(
  '/:hallId',
  authMiddleware,
  requirePermission(PERMISSIONS.HALLS.EDIT),
  auditLogger('HALL_CRUD'),
  hallController.updateHall
);

// Delete
router.delete(
  '/:hallId',
  authMiddleware,
  requirePermission(PERMISSIONS.HALLS.DELETE),
  auditLogger('HALL_CRUD'),
  hallController.deleteHall
);

// Restore
router.post(
  '/:hallId/restore',
  authMiddleware,
  requirePermission(PERMISSIONS.HALLS.DELETE),
  auditLogger('HALL_CRUD'),
  hallController.restoreHall
);

// Toggle visibility
router.patch(
  '/:hallId/toggle-visibility',
  authMiddleware,
  requirePermission(PERMISSIONS.HALLS.EDIT),
  auditLogger('HALL_CRUD'),
  hallController.toggleHallVisibility
);

module.exports = router;