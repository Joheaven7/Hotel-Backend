const express = require('express');
const roomController = require('./room.controller');
const authMiddleware = require('../../middlewares/auth');
const { roleCheck } = require('../../middlewares/roleCheck');
const { ROLES } = require('../../config/constants');
const { auditLogger } = require('../../middlewares/auditLogger');

const router = express.Router();

// ── Public ─────────────────────────────────────────────────────────────────────
// Get all rooms (supports ?type=&status=&checkInDate=&checkOutDate= filters)
router.get('/', roomController.getAllRooms);

// /availability is a public alias for getAllRooms with date filtering
// Landing page Booking.jsx calls this endpoint
router.get('/availability', roomController.getAllRooms);

// Occupancy report — MUST come before /:roomId
router.get(
  '/occupancy/report',
  authMiddleware,
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF),
  roomController.getRoomOccupancy
);

// Room type availability checker — MUST come before /:roomId
router.get(
  '/available-by-type',
  authMiddleware,
  roomController.getAvailableByType
);

// Single room — public
router.get('/:roomId', roomController.getRoomById);

// ── Protected ─────────────────────────────────────────────────────────────────
// Create — ADMIN only
router.post(
  '/',
  authMiddleware,
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  auditLogger('ROOM_CRUD'),
  roomController.createRoom
);

// Full update — ADMIN only
router.put(
  '/:roomId',
  authMiddleware,
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  auditLogger('ROOM_CRUD'),
  roomController.updateRoom
);

// Status update — ADMIN/STAFF
router.patch(
  '/:roomId/status',
  authMiddleware,
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STAFF),
  auditLogger('ROOM_CRUD'),
  roomController.updateRoomStatus
);

// Delete — ADMIN only
router.delete(
  '/:roomId',
  authMiddleware,
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  auditLogger('ROOM_CRUD'),
  roomController.deleteRoom
);

// Restore — ADMIN only
router.post(
  '/:roomId/restore',
  authMiddleware,
  roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  auditLogger('ROOM_CRUD'),
  roomController.restoreRoom
);

module.exports = router;