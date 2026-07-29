const express = require('express');
const roomController = require('./room.controller');
const authMiddleware = require('../../middlewares/auth');
const { requirePermission } = require('../../middlewares/permissionCheck');
const { PERMISSIONS } = require('../../config/constants');
const { auditLogger } = require('../../middlewares/auditLogger');

const router = express.Router();

// ── Public ─────────────────────────────────────────────────────────────────────
// Get all rooms (supports ?type=&status=&checkInDate=&checkOutDate= filters)
router.get('/', roomController.getAllRooms);

// /availability is a public alias for getAllRooms with date filtering
// Landing page Booking.jsx calls this endpoint
router.get('/availability', roomController.getAllRooms);

// Occupancy report
router.get(
  '/occupancy/report',
  authMiddleware,
  requirePermission(PERMISSIONS.ROOMS.VIEW),
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
// Create
router.post(
  '/',
  authMiddleware,
  requirePermission(PERMISSIONS.ROOMS.CREATE),
  auditLogger('ROOM_CRUD'),
  roomController.createRoom
);

// Full update
router.put(
  '/:roomId',
  authMiddleware,
  requirePermission(PERMISSIONS.ROOMS.EDIT),
  auditLogger('ROOM_CRUD'),
  roomController.updateRoom
);

// Status update
router.patch(
  '/:roomId/status',
  authMiddleware,
  requirePermission(PERMISSIONS.ROOMS.EDIT),
  auditLogger('ROOM_CRUD'),
  roomController.updateRoomStatus
);

// Delete
router.delete(
  '/:roomId',
  authMiddleware,
  requirePermission(PERMISSIONS.ROOMS.DELETE),
  auditLogger('ROOM_CRUD'),
  roomController.deleteRoom
);

// Restore
router.post(
  '/:roomId/restore',
  authMiddleware,
  requirePermission(PERMISSIONS.ROOMS.DELETE),
  auditLogger('ROOM_CRUD'),
  roomController.restoreRoom
);

// Regenerate QR Token (Super Admin / Admin)
router.post(
  '/:roomId/regenerate-qr',
  authMiddleware,
  requirePermission(PERMISSIONS.ROOMS.EDIT),
  auditLogger('ROOM_CRUD'),
  roomController.regenerateRoomQr
);

// Toggle Room Service (Super Admin / Admin)
router.patch(
  '/:roomId/toggle-room-service',
  authMiddleware,
  requirePermission(PERMISSIONS.ROOMS.EDIT),
  auditLogger('ROOM_CRUD'),
  roomController.toggleRoomService
);

module.exports = router;