const Room = require('../../models/Room');
const Reservation = require('../../models/Reservation');
const Maintenance = require('../../models/Maintenance');
const { ROOM_STATUS, RESERVATION_STATUS } = require('../../config/constants');
const { checkOverlap } = require('../../utils/dateHelper');

// Create room
const createRoom = async (req, res) => {
  try {
    const { roomNumber, floor, roomTypeId, status, housekeepingStatus } = req.body;

    if (!roomNumber) {
      return res.status(400).json({ message: 'Room number is required' });
    }

    if (!roomTypeId) {
      return res.status(400).json({ message: 'roomTypeId is required — select a room type first' });
    }

    const existing = await Room.findOne({ roomNumber });
    if (existing) {
      return res.status(409).json({ message: 'Room number already exists' });
    }

    const RoomType = require('../../models/RoomType');
    const roomType = await RoomType.findById(roomTypeId);
    if (!roomType || roomType.isDeleted) {
      return res.status(404).json({ message: 'Room type not found' });
    }

    const newRoom = new Room({
      roomNumber,
      floor: floor || null,
      roomTypeId,
      status: status || ROOM_STATUS.AVAILABLE,
      housekeepingStatus: housekeepingStatus || 'CLEAN',
      // Legacy fields populated automatically by pre-save hook
    });

    await newRoom.save();
    await newRoom.populate('roomTypeId', 'name basePricePerNight maxOccupancy amenities images');

    if (req.io) req.io.emit('room:created', newRoom);

    res.status(201).json({
      message: 'Room created successfully',
      room: newRoom,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create room', error: error.message });
  }
};
// Get all rooms with availability info
const getAllRooms = async (req, res) => {
  try {
    const { type, status, checkInDate, checkOutDate } = req.query;

    // Build filter
    let filter = { isActive: true };
    if (type) filter.type = type;
    if (status) filter.status = status;

    let rooms = await Room.find(filter);

    // If date range provided, check availability
    if (checkInDate && checkOutDate) {
      const checkIn = new Date(checkInDate);
      const checkOut = new Date(checkOutDate);

      rooms = await Promise.all(
        rooms.map(async (room) => {
          // Find overlapping reservations
          const overlappingReservations = await Reservation.findOne({
            roomId: room._id,
            status: { $in: [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.CHECKED_IN] },
            $expr: {
              $and: [
                { $lt: ['$checkInDate', checkOut] },
                { $gt: ['$checkOutDate', checkIn] },
              ],
            },
          });

          // Find maintenance blocking
          const maintenanceBlock = await Maintenance.findOne({
            roomId: room._id,
            status: { $in: ['OPEN', 'IN_PROGRESS'] },
            blocksDates: { $elemMatch: { $gte: checkIn, $lt: checkOut } },
          });

          return {
            ...room.toObject(),
            isAvailable: !overlappingReservations && !maintenanceBlock,
            hasConflict: !!overlappingReservations || !!maintenanceBlock,
          };
        })
      );
    }

    res.json({
      total: rooms.length,
      rooms,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch rooms', error: error.message });
  }
};

// Get single room
const getRoomById = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Get recent reservations
    const reservations = await Reservation.find({
      roomId,
      status: { $ne: RESERVATION_STATUS.CANCELLED },
    })
      .sort({ checkInDate: -1 })
      .limit(10)
      .populate('customerId', 'firstName lastName email phone');

    // Get active maintenance
    const maintenance = await Maintenance.find({
      roomId,
      status: { $in: ['OPEN', 'IN_PROGRESS'] },
    }).populate('assignedTo', 'firstName lastName');

    res.json({
      room,
      recentReservations: reservations,
      activeMaintenance: maintenance,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch room', error: error.message });
  }
};

const updateRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { roomNumber, roomTypeId, type, capacity, pricePerNight, floor, amenities, status, description, images } = req.body;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Handle roomNumber - check for duplicates
    if (roomNumber && roomNumber !== room.roomNumber) {
      const existingRoom = await Room.findOne({
        roomNumber,
        _id: { $ne: roomId }
      });
      if (existingRoom) {
        return res.status(409).json({ message: 'Room number already exists' });
      }
      room.roomNumber = roomNumber;
    }

    if (roomTypeId !== undefined) room.roomTypeId = roomTypeId;
    if (type !== undefined) room.type = type;
    if (capacity !== undefined) room.capacity = capacity;
    if (pricePerNight !== undefined) room.pricePerNight = pricePerNight;
    if (floor !== undefined) room.floor = floor;
    if (amenities !== undefined) room.amenities = amenities;
    if (status !== undefined) room.status = status;
    if (description !== undefined) room.description = description;
    if (images !== undefined) room.images = images;

    const updatedRoom = await room.save();

    // Emit socket event
    if (req.io) {
      req.io.emit('room:updated', updatedRoom);
    }

    res.json({
      message: 'Room updated successfully',
      room: updatedRoom,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update room', error: error.message });
  }
};
// Delete room (soft delete)
const deleteRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findByIdAndUpdate(
      roomId,
      { isActive: false, isDeleted: true },
      { new: true }
    );

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Emit socket event
    if (req.io) {
      req.io.emit('room:deleted', { roomId: room._id, roomNumber: room.roomNumber });
    }

    res.json({
      message: 'Room deleted successfully',
      room,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete room', error: error.message });
  }
};

// Restore room
const restoreRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findByIdAndUpdate(
      roomId,
      { isActive: true, isDeleted: false },
      { new: true }
    );

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Emit socket event
    if (req.io) {
      req.io.emit('room:restored', { roomId: room._id, roomNumber: room.roomNumber });
    }

    res.json({
      message: 'Room restored successfully',
      room,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to restore room', error: error.message });
  }
};

// Get room occupancy for date range
const getRoomOccupancy = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const rooms = await Room.find({ isActive: true });

    const occupancyData = await Promise.all(
      rooms.map(async (room) => {
        const reservations = await Reservation.countDocuments({
          roomId: room._id,
          status: { $in: [RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.CHECKED_IN] },
          $expr: {
            $and: [
              { $lt: ['$checkInDate', end] },
              { $gt: ['$checkOutDate', start] },
            ],
          },
        });

        return {
          roomId: room._id,
          roomNumber: room.roomNumber,
          type: room.type,
          occupancyCount: reservations,
          isOccupied: reservations > 0,
        };
      })
    );

    const totalRooms = rooms.length;
    const occupiedRooms = occupancyData.filter((r) => r.isOccupied).length;
    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    res.json({
      dateRange: { startDate: start, endDate: end },
      totalRooms,
      occupiedRooms,
      occupancyRate: occupancyRate.toFixed(2),
      roomDetails: occupancyData,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch occupancy', error: error.message });
  }
};

// Update room status
const updateRoomStatus = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { status, housekeepingStatus } = req.body;

    if (!status && !housekeepingStatus) {
      return res.status(400).json({ message: 'status or housekeepingStatus is required' });
    }

    const update = {};
    if (status) update.status = status;
    if (housekeepingStatus) update.housekeepingStatus = housekeepingStatus;

    // When marked CLEAN, record timestamp and who cleaned it
    if (housekeepingStatus === 'CLEAN') {
      update.lastCleanedAt = new Date();
      update.lastCleanedBy = req.user?._id || null;
    }

    const room = await Room.findByIdAndUpdate(roomId, update, {
      new: true, runValidators: true,
    }).populate('roomTypeId', 'name basePricePerNight');

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Real-time broadcast
    if (req.io) {
      req.io.to('role:ADMIN').to('role:MANAGER').to('role:STAFF').to('role:SUPER_ADMIN')
        .emit('room:statusChanged', {
          roomId: room._id,
          roomNumber: room.roomNumber,
          status: room.status,
          housekeepingStatus: room.housekeepingStatus,
        });
    }

    res.json({ message: 'Room status updated', room });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update room status', error: error.message });
  }
};

const getAvailableByType = async (req, res) => {
  try {
    const { type, checkInDate, checkOutDate, numberOfGuests } = req.query;

    if (!type || !checkInDate || !checkOutDate) {
      return res.status(400).json({ message: 'type, checkInDate, and checkOutDate are required' });
    }

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return res.status(400).json({ message: 'Invalid dates provided' });
    }

    // Find all clean, active physical rooms of this type
    const candidates = await Room.find({
      roomTypeId: type,
      status: { $nin: ['MAINTENANCE', 'BLOCKED'] },
      isDeleted: { $ne: true },
      isActive: true,
      housekeepingStatus: 'CLEAN',
      ...(numberOfGuests ? { capacity: { $gte: parseInt(numberOfGuests) } } : {}),
    }).populate('roomTypeId');

    if (candidates.length === 0) {
      const RoomType = require('../../models/RoomType');
      const otherTypes = await RoomType.find({
        _id: { $ne: type },
        isDeleted: { $ne: true },
        isPublished: true,
        maxOccupancy: { $gte: parseInt(numberOfGuests) || 1 }
      }).limit(3);

      const alternatives = otherTypes.map(t => ({
        _id: t._id,
        type: t.name,
        capacity: t.maxOccupancy,
        pricePerNight: t.basePricePerNight
      }));

      return res.json({
        available: false,
        alternatives
      });
    }

    // Find active conflicting reservations
    const conflictingRoomIds = (await Reservation.find({
      roomId: { $in: candidates.map(r => r._id) },
      status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
      checkInDate: { $lt: checkOut },
      checkOutDate: { $gt: checkIn },
    }).distinct('roomId')).map(id => id.toString());

    const availableRooms = candidates.filter(r => !conflictingRoomIds.includes(r._id.toString()));

    if (availableRooms.length > 0) {
      const room = availableRooms[0];
      return res.json({
        available: true,
        room: {
          type: room.roomTypeId?.name || room.type || 'Room',
          capacity: room.capacity,
          pricePerNight: room.pricePerNight || room.roomTypeId?.basePricePerNight || 0
        }
      });
    } else {
      const RoomType = require('../../models/RoomType');
      const otherTypes = await RoomType.find({
        _id: { $ne: type },
        isDeleted: { $ne: true },
        isPublished: true,
        maxOccupancy: { $gte: parseInt(numberOfGuests) || 1 }
      }).limit(3);

      const alternatives = otherTypes.map(t => ({
        _id: t._id,
        type: t.name,
        capacity: t.maxOccupancy,
        pricePerNight: t.basePricePerNight
      }));

      return res.json({
        available: false,
        alternatives
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Failed to check availability', error: error.message });
  }
};

module.exports = {
  createRoom,
  getAllRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
  restoreRoom,
  getRoomOccupancy,
  updateRoomStatus,
  getAvailableByType,
};