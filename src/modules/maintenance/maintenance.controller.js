const Maintenance = require('../../models/Maintenance');
const Room = require('../../models/Room');
const { MAINTENANCE_STATUS, ROOM_STATUS, ROLES } = require('../../config/constants');
const { createNotification } = require('../../services/notificationService');

// Create maintenance request
const createMaintenance = async (req, res) => {
  try {
    const { roomId, title, description, priority, blocksDates, assignedTo } = req.body;

    // Validate room exists
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Validate priority
    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (priority && !validPriorities.includes(priority)) {
      return res.status(400).json({ message: 'Invalid priority' });
    }

    const maintenance = new Maintenance({
      roomId,
      title,
      description,
      priority: priority || 'MEDIUM',
      blocksDates: blocksDates || [],
      assignedTo: assignedTo || null,
      reportedBy: req.user._id,
      status: MAINTENANCE_STATUS.OPEN,
    });

    await maintenance.save();
    await maintenance.populate('roomId', 'roomNumber type');
    await maintenance.populate('reportedBy', 'firstName lastName email');
    await maintenance.populate('assignedTo', 'firstName lastName email department');

    // If high priority or urgent, change room status to MAINTENANCE
    if (['HIGH', 'URGENT'].includes(maintenance.priority)) {
      await Room.findByIdAndUpdate(roomId, {
        status: ROOM_STATUS.MAINTENANCE,
      });
    }

    // Emit socket event
    if (req.io) {
      req.io.emit('maintenance:added', {
        maintenance,
        roomId,
        priority: maintenance.priority,
      });
    }

    res.status(201).json({
      message: 'Maintenance request created',
      maintenance,
    });
       createNotification(req.io, {
  title:        'Maintenance Request Created',
  message:      `New ${maintenance.priority?.toLowerCase()} priority maintenance request for Room ${maintenance.roomId?.roomNumber || ''}.`,
  type:         'MAINTENANCE_CREATED',
  senderId:     req.user._id,
  targetRoles:  ['SUPER_ADMIN', 'ADMIN'],
  resourceId:   maintenance._id,
  resourceType: 'Maintenance',
});

  } catch (error) {
    res.status(500).json({
      message: 'Failed to create maintenance',
      error: error.message,
    });
  }
};

// Get all maintenance requests
const getAllMaintenance = async (req, res) => {
  try {
    const { status, roomId, priority, assignedTo, page = 1, limit = 10 } = req.query;

    let filter = {};
    if (status) filter.status = status;
    if (roomId) filter.roomId = roomId;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;

    const skip = (page - 1) * limit;

    const maintenance = await Maintenance.find(filter)
      .populate('roomId', 'roomNumber type floor')
      .populate('reportedBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email department')
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Maintenance.countDocuments(filter);

    // Count by status
    const statusCount = await Maintenance.aggregate([
      { $match: filter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit),
      statusBreakdown: statusCount,
      maintenance,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch maintenance requests',
      error: error.message,
    });
  }
};

// Get single maintenance request
const getMaintenanceById = async (req, res) => {
  try {
    const { maintenanceId } = req.params;

    const maintenance = await Maintenance.findById(maintenanceId)
      .populate('roomId', 'roomNumber type floor capacity pricePerNight')
      .populate('reportedBy', 'firstName lastName email phone')
      .populate('assignedTo', 'firstName lastName email department phone');

    if (!maintenance) {
      return res.status(404).json({ message: 'Maintenance request not found' });
    }

    res.json(maintenance);
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch maintenance',
      error: error.message,
    });
  }
};

// Assign maintenance to staff
const assignMaintenance = async (req, res) => {
  try {
    const { maintenanceId } = req.params;
    const { staffId } = req.body;

    const maintenance = await Maintenance.findByIdAndUpdate(
      maintenanceId,
      { assignedTo: staffId },
      { new: true }
    )
      .populate('roomId', 'roomNumber')
      .populate('assignedTo', 'firstName lastName email department');

    if (!maintenance) {
      return res.status(404).json({ message: 'Maintenance request not found' });
    }

    // Emit socket event
    if (req.io) {
      req.io.emit('maintenance:assigned', {
        maintenanceId,
        assignedTo: staffId,
        roomNumber: maintenance.roomId.roomNumber,
      });
    }

    res.json({
      message: 'Maintenance assigned',
      maintenance,
    });
  
     // Notify the assigned staff member directly
if (maintenance.assignedTo) {
  createNotification(req.io, {
    title:        'Maintenance Task Assigned',
    message:      `You have been assigned a maintenance task: ${maintenance.description || 'See details'}.`,
    type:         'MAINTENANCE_UPDATED',
    senderId:     req.user._id,
    receiverId:   maintenance.assignedTo,
    resourceId:   maintenance._id,
    resourceType: 'Maintenance',
  });
}

  } catch (error) {
    res.status(500).json({
      message: 'Failed to assign maintenance',
      error: error.message,
    });
  }
};

// Update maintenance status
const updateMaintenanceStatus = async (req, res) => {
  try {
    const { maintenanceId } = req.params;
    const { status, notes, cost } = req.body;

    // 1. Validate status input
    const validStatuses = Object.values(MAINTENANCE_STATUS);
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // 2. Fetch maintenance log
    const maintenance = await Maintenance.findById(maintenanceId);
    if (!maintenance) {
      return res.status(404).json({ message: 'Maintenance request not found' });
    }

    // Capture the raw Room ID safely before modifications
    const targetRoomId = maintenance.roomId;

    maintenance.status = status;
    if (notes) maintenance.notes = notes;
    if (cost !== undefined) maintenance.cost = cost;

    // Set progression timestamps
    if (status === MAINTENANCE_STATUS.IN_PROGRESS && !maintenance.startDate) {
      maintenance.startDate = new Date();
    }

    if (status === MAINTENANCE_STATUS.COMPLETED || status === MAINTENANCE_STATUS.CANCELLED) {
      if (status === MAINTENANCE_STATUS.COMPLETED) {
        maintenance.endDate = new Date();
      }
      // Change room status back to AVAILABLE safely using the captured ID
      await Room.findByIdAndUpdate(targetRoomId, {
        status: ROOM_STATUS.AVAILABLE,
      });
    }

    // 3. Save modifications
    await maintenance.save();
    
    // 4. Populate references FIRST
    await maintenance.populate('roomId', 'roomNumber');
    await maintenance.populate('assignedTo', 'firstName lastName');

    // 5. Emit socket event safely (using the populated object or the captured ID)
    if (req.io) {
      req.io.emit('maintenance:statusChanged', {
        maintenanceId,
        status: maintenance.status,
        roomId: targetRoomId, // ✅ Clean, safe database ID reference
      });
    }

    res.json({
      message: 'Maintenance status updated',
      maintenance,
    });
  } catch (error) {
    // This will now print exactly what failed to your terminal console logs
    console.error("Error updating maintenance status:", error);
    res.status(500).json({
      message: 'Failed to update maintenance',
      error: error.message,
    });
  }
};

// Get maintenance by room
const getMaintenanceByRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const maintenance = await Maintenance.find({ roomId })
      .populate('reportedBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({
      roomId,
      roomNumber: room.roomNumber,
      maintenanceCount: maintenance.length,
      maintenance,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch maintenance',
      error: error.message,
    });
  }
};

// Get maintenance statistics
const getMaintenanceStats = async (req, res) => {
  try {
    const { startDate, endDate, priority } = req.query;

    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    let priorityFilter = {};
    if (priority) priorityFilter = { priority };

    // Total maintenance requests
    const totalRequests = await Maintenance.countDocuments({
      ...dateFilter,
      ...priorityFilter,
    });

    // By status
    const byStatus = await Maintenance.aggregate([
      { $match: { ...dateFilter, ...priorityFilter } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // By priority
    const byPriority = await Maintenance.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]);

    // Total cost
    const totalCost = await Maintenance.aggregate([
      { $match: { ...dateFilter, cost: { $exists: true } } },
      { $group: { _id: null, total: { $sum: '$cost' } } },
    ]);

    // Average resolution time (completed requests)
    const avgResolutionTime = await Maintenance.aggregate([
      {
        $match: {
          ...dateFilter,
          status: MAINTENANCE_STATUS.COMPLETED,
          startDate: { $exists: true },
          endDate: { $exists: true },
        },
      },
      {
        $group: {
          _id: null,
          avgTime: {
            $avg: {
              $subtract: ['$endDate', '$startDate'],
            },
          },
        },
      },
    ]);

    res.json({
      dateRange: {
        startDate: startDate || 'All time',
        endDate: endDate || 'Today',
      },
      totalRequests,
      byStatus,
      byPriority,
      totalCost: totalCost[0]?.total || 0,
      avgResolutionTimeHours: avgResolutionTime[0]
        ? (avgResolutionTime[0].avgTime / (1000 * 60 * 60)).toFixed(2)
        : 0,
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to fetch maintenance stats',
      error: error.message,
    });
  }
};

// Add this function to your maintenance.controller.js

// Delete maintenance request
const deleteMaintenance = async (req, res) => {
  try {
    const { maintenanceId } = req.params;

    const maintenance = await Maintenance.findById(maintenanceId);
    if (!maintenance) {
      return res.status(404).json({ message: 'Maintenance request not found' });
    }

    // If room was marked as MAINTENANCE, reset it to AVAILABLE
    if (maintenance.roomId) {
      await Room.findByIdAndUpdate(maintenance.roomId, {
        status: ROOM_STATUS.AVAILABLE,
      });
    }

    await Maintenance.findByIdAndDelete(maintenanceId);

    // Emit socket event
    if (req.io) {
      req.io.emit('maintenance:deleted', {
        maintenanceId,
        roomId: maintenance.roomId,
      });
    }

    res.json({
      message: 'Maintenance request deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      message: 'Failed to delete maintenance',
      error: error.message,
    });
  }
};

// Export it
module.exports = {
  createMaintenance,
  getAllMaintenance,
  getMaintenanceById,
  assignMaintenance,
  updateMaintenanceStatus,
  getMaintenanceByRoom,
  getMaintenanceStats,
  deleteMaintenance,  // ✅ ADD THIS
};

