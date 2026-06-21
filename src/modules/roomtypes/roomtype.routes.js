const express = require('express');
const router = express.Router();
const RoomType = require('../../models/RoomType');
const Room = require('../../models/Room');
const authMiddleware = require('../../middlewares/auth');
const { roleCheck } = require('../../middlewares/roleCheck');
const { ROLES } = require('../../config/constants');

// ── PUBLIC — gallery reads only marketing fields ─────────────────────────────
router.get('/public', async (req, res) => {
    try {
        const types = await RoomType.find({ isPublished: true, isDeleted: false })
            .select('name slug description basePricePerNight maxOccupancy amenities images')
            .sort({ basePricePerNight: 1 });
        res.json({ roomTypes: types });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch room types', error: err.message });
    }
});

// ── All routes below require auth ────────────────────────────────────────────
router.use(authMiddleware);

// GET all room types (admin view — includes unpublished)
router.get('/', roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF), async (req, res) => {
    try {
        const types = await RoomType.find({ isDeleted: false }).sort({ basePricePerNight: 1 });

        // Attach physical room count per type
        const withCounts = await Promise.all(
            types.map(async (t) => {
                const count = await Room.countDocuments({ roomTypeId: t._id, isDeleted: false });
                return { ...t.toObject(), roomCount: count };
            })
        );

        res.json({ roomTypes: withCounts });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch room types', error: err.message });
    }
});

// GET single room type
router.get('/:id', roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER), async (req, res) => {
    try {
        const type = await RoomType.findOne({ _id: req.params.id, isDeleted: false });
        if (!type) return res.status(404).json({ message: 'Room type not found' });
        const rooms = await Room.find({ roomTypeId: req.params.id, isDeleted: false })
            .select('roomNumber floor status housekeepingStatus');
        res.json({ roomType: type, rooms });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch room type', error: err.message });
    }
});

// CREATE room type
router.post('/', roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER), async (req, res) => {
    try {
        const { name, description, basePricePerNight, maxOccupancy, amenities, images, isPublished } = req.body;

        if (!name?.trim() || !basePricePerNight || !maxOccupancy) {
            return res.status(400).json({ message: 'name, basePricePerNight, and maxOccupancy are required' });
        }
        const existing = await RoomType.findOne({ name: name.trim() });
        if (existing) return res.status(409).json({ message: `Room type "${name}" already exists` });

        const roomType = await RoomType.create({
            name: name.trim(),
            description: description || '',
            basePricePerNight: Number(basePricePerNight),
            maxOccupancy: Number(maxOccupancy),
            amenities: Array.isArray(amenities)
                ? amenities.filter(Boolean)
                : amenities ? amenities.split(',').map((s) => s.trim()).filter(Boolean) : [],
            images: Array.isArray(images) ? images : images ? [images] : [],
            isPublished: isPublished !== false,
        });

        res.status(201).json({ message: 'Room type created', roomType });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: 'A room type with a similar name already exists' });
        }
        res.status(500).json({ message: 'Failed to create room type', error: err.message });
    }
});

// UPDATE room type — cascades price/amenity/occupancy to all linked rooms
router.put('/:id', roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER), async (req, res) => {
    try {
        const { name, description, basePricePerNight, maxOccupancy, amenities, images, isPublished } = req.body;

        const update = {};
        if (name !== undefined) update.name = name.trim();
        if (description !== undefined) update.description = description;
        if (basePricePerNight !== undefined) update.basePricePerNight = Number(basePricePerNight);
        if (maxOccupancy !== undefined) update.maxOccupancy = Number(maxOccupancy);
        if (isPublished !== undefined) update.isPublished = isPublished;
        if (amenities !== undefined) {
            update.amenities = Array.isArray(amenities)
                ? amenities.filter(Boolean)
                : amenities.split(',').map((s) => s.trim()).filter(Boolean);
        }
        if (images !== undefined) {
            update.images = Array.isArray(images) ? images : [images];
        }

        const roomType = await RoomType.findByIdAndUpdate(req.params.id, update, {
            new: true, runValidators: true,
        });
        if (!roomType) return res.status(404).json({ message: 'Room type not found' });

        // Cascade to all physical rooms linked to this type
        const cascadeFields = {};
        if (update.maxOccupancy) cascadeFields.capacity = update.maxOccupancy;
        if (update.basePricePerNight) cascadeFields.pricePerNight = update.basePricePerNight;
        if (update.amenities) cascadeFields.amenities = update.amenities;
        if (update.description) cascadeFields.description = update.description;
        if (Object.keys(cascadeFields).length > 0) {
            await Room.updateMany({ roomTypeId: req.params.id }, { $set: cascadeFields });
        }

        res.json({ message: 'Room type updated and synced to all physical rooms', roomType });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: 'A room type with a similar name already exists' });
        }
        res.status(500).json({ message: 'Failed to update room type', error: err.message });
    }
});

// SOFT DELETE room type
router.delete('/:id', roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN), async (req, res) => {
    try {
        // Block delete if physical rooms are still linked
        const roomCount = await Room.countDocuments({ roomTypeId: req.params.id, isDeleted: false });
        if (roomCount > 0) {
            return res.status(400).json({
                message: `Cannot delete — ${roomCount} room(s) still use this type. Remove or reassign them first.`,
            });
        }
        const roomType = await RoomType.findByIdAndUpdate(
            req.params.id, { isDeleted: true, isPublished: false }, { new: true }
        );
        if (!roomType) return res.status(404).json({ message: 'Room type not found' });
        res.json({ message: 'Room type deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete room type', error: err.message });
    }
});

module.exports = router;