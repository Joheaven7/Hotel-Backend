const express = require('express');
const hallController = require('./hall.controller');
const authMiddleware = require('../../middlewares/auth');
const { roleCheck }  = require('../../middlewares/roleCheck');
const { ROLES }      = require('../../config/constants');
const { auditLogger } = require('../../middlewares/auditLogger');

const router = express.Router();

// ── Public ─────────────────────────────────────────────────────────────────────
router.get('/', hallController.getAllHalls);

// Public catalog — explicit path before /:hallId
router.get(
  '/public-catalog',
  authMiddleware,
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF),
  hallController.getPublicLandingHalls
);

// Single hall — public
router.get('/:hallId', hallController.getHallById);

// ── Protected ─────────────────────────────────────────────────────────────────
// Create — ADMIN only (removed STAFF — they don't manage hall inventory)
router.post(
  '/',
  authMiddleware,
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  auditLogger('HALL_CRUD'),
  hallController.createHall
);

// Update — ADMIN only
router.patch(
  '/:hallId',
  authMiddleware,
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  auditLogger('HALL_CRUD'),
  hallController.updateHall
);

// Delete — ADMIN only
router.delete(
  '/:hallId',
  authMiddleware,
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  auditLogger('HALL_CRUD'),
  hallController.deleteHall
);

// Restore — ADMIN only
router.post(
  '/:hallId/restore',
  authMiddleware,
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  auditLogger('HALL_CRUD'),
  hallController.restoreHall
);

// Toggle visibility — ADMIN only
router.patch(
  '/:hallId/toggle-visibility',
  authMiddleware,
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  auditLogger('HALL_CRUD'),
  hallController.toggleHallVisibility
);

module.exports = router;