const Hall = require('../../models/Hall');

// Create new hall
const createHall = async (req, res) => {
  try {
    const { hallName, floor, hallTypeId, status, housekeepingStatus } = req.body;

    if (!hallName) return res.status(400).json({ message: 'Hall name is required' });
    if (!hallTypeId) return res.status(400).json({ message: 'hallTypeId is required — select a hall type first' });

    const existing = await Hall.findOne({ hallName });
    if (existing) return res.status(409).json({ message: 'A hall with this name already exists' });

    const HallType = require('../../models/HallType');
    const hallType = await HallType.findById(hallTypeId);
    if (!hallType || hallType.isDeleted) {
      return res.status(404).json({ message: 'Hall type not found' });
    }

    const newHall = new Hall({
      hallName,
      floor: floor || null,
      hallTypeId,
      status: status || 'AVAILABLE',
      housekeepingStatus: housekeepingStatus || 'CLEAN',
    });

    await newHall.save();
    await newHall.populate('hallTypeId', 'name basePricePerHour maxOccupancy amenities images');

    if (req.io) req.io.emit('hall:created', newHall);
    res.status(201).json({ message: 'Hall created successfully', hall: newHall });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create hall', error: error.message });
  }
};

// Get all halls
const getAllHalls = async (req, res) => {
  try {
    const { isActive, includeDeleted, adminView } = req.query;

    let filter = {};

    // Explicitly exclude soft-deleted items unless specified
    if (includeDeleted !== 'true') {
      filter.isDeleted = { $ne: true };
    }

    // Admin view shows ALL halls (both active and inactive)
    // Public view shows only active halls (for landing page)
    if (adminView === 'true') {
      // Admin dashboard: no isActive filter (show all halls)
      // isActive filter is NOT set — all halls returned regardless of status
    } else if (isActive !== undefined) {
      // Explicit isActive parameter takes precedence
      filter.isActive = isActive === 'true';
    } else {
      // Default public view: only show active halls
      filter.isActive = true;
    }

    const halls = await Hall.find(filter);

    res.json({
      total: halls.length,
      halls,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch halls', error: error.message });
  }
};

// Get single hall
const getHallById = async (req, res) => {
  try {
    const { hallId } = req.params;

    const hall = await Hall.findById(hallId);
    if (!hall) {
      return res.status(404).json({ message: 'Hall not found' });
    }

    res.json(hall);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch hall', error: error.message });
  }
};

// Update hall
const updateHall = async (req, res) => {
  try {
    const { hallId } = req.params;
    const { hallName, capacity, pricePerHour, amenities, description, images, isActive, status } = req.body;

    const updateData = {};

    if (hallName != null) {
      const duplicateName = await Hall.findOne({ hallName, _id: { $ne: hallId } });
      if (duplicateName) {
        return res.status(409).json({ message: 'Another hall with this name already exists' });
      }
      updateData.hallName = hallName;
    }

    if (capacity != null) updateData.capacity = capacity;
    if (pricePerHour != null) updateData.pricePerHour = pricePerHour;
    if (description != null) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Process status update smoothly
    if (status != null) updateData.status = status;

    if (amenities != null) {
      updateData.amenities = Array.isArray(amenities)
        ? amenities
        : amenities.split(',').map(s => s.trim());
    }
    if (images != null) {
      updateData.images = Array.isArray(images) ? images : [images];
    }

    const updatedHall = await Hall.findByIdAndUpdate(hallId, updateData, {
      new: true,
      runValidators: true, // This checks that the updated status matches the enum values
    });

    if (!updatedHall) {
      return res.status(404).json({ message: 'Hall not found' });
    }

    if (req.io) {
      req.io.emit('hall:updated', updatedHall);
    }
    res.json({ message: 'Hall updated successfully', hall: updatedHall });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation failed', errors: error.errors });
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Conflict: Hall name must be unique.' });
    }
    res.status(500).json({ message: 'Failed to update hall', error: error.message });
  }
};

// Delete hall (soft delete)
const deleteHall = async (req, res) => {
  try {
    const { hallId } = req.params;

    const hall = await Hall.findByIdAndUpdate(
      hallId,
      { isActive: false, isDeleted: true, status: 'Maintenance' },
      { new: true }
    );

    if (!hall) {
      return res.status(404).json({ message: 'Hall not found' });
    }

    // Emit socket event
    if (req.io) {
      req.io.emit('hall:deleted', { hallId: hall._id, hallName: hall.hallName });
    }

    res.json({
      message: 'Hall deleted successfully',
      hall,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete hall', error: error.message });
  }
};

// Restore hall
const restoreHall = async (req, res) => {
  try {
    const { hallId } = req.params;

    const hall = await Hall.findByIdAndUpdate(
      hallId,
      { isActive: true, isDeleted: false },
      { new: true }
    );

    if (!hall) {
      return res.status(404).json({ message: 'Hall not found' });
    }

    // Emit socket event
    if (req.io) {
      req.io.emit('hall:restored', { hallId: hall._id, hallName: hall.hallName });
    }

    res.json({
      message: 'Hall restored successfully',
      hall,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to restore hall', error: error.message });
  }
};

// Toggle Visibility (Hide/Show on Landing Page)
const toggleHallVisibility = async (req, res) => {
  try {
    const { hallId } = req.params;

    const hall = await Hall.findById(hallId);
    if (!hall) {
      return res.status(404).json({ message: 'Hall not found' });
    }

    // Flip the active status flag
    hall.isActive = !hall.isActive;
    await hall.save();

    // Notify connected clients via socket
    if (req.io) {
      req.io.emit('hall:updated', hall);
    }

    res.json({
      message: `Hall is now ${hall.isActive ? 'visible on' : 'hidden from'} the landing page`,
      hall
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update visibility status', error: error.message });
  }
};

// Dedicated public route for the landing page catalog
const getPublicLandingHalls = async (req, res) => {
  try {
    const halls = await Hall.find({
      isActive: true,
      isDeleted: { $ne: true }
    });

    res.json({
      total: halls.length,
      halls,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch public landing page data', error: error.message });
  }
};


module.exports = {
  createHall,
  getAllHalls,
  getPublicLandingHalls,
  getHallById,
  updateHall,
  deleteHall,
  restoreHall,
  toggleHallVisibility,
};