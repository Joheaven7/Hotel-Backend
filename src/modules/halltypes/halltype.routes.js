const express = require('express');
const router = express.Router();
const HallType = require('../../models/HallType');
const Hall = require('../../models/Hall');
const authMiddleware = require('../../middlewares/auth');
const { roleCheck } = require('../../middlewares/roleCheck');
const { ROLES } = require('../../config/constants');

// ── PUBLIC ───────────────────────────────────────────────────────────────────
router.get('/public', async (req, res) => {
    try {
        const types = await HallType.find({ isPublished: true, isDeleted: false })
            .select('name slug description basePricePerHour maxOccupancy amenities images')
            .sort({ basePricePerHour: 1 });
        res.json({ hallTypes: types });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch hall types', error: err.message });
    }
});

router.use(authMiddleware);

router.get('/', roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF), async (req, res) => {
    try {
        const types = await HallType.find({ isDeleted: false }).sort({ basePricePerHour: 1 });
        const withCounts = await Promise.all(
            types.map(async (t) => {
                const count = await Hall.countDocuments({ hallTypeId: t._id, isDeleted: false });
                return { ...t.toObject(), hallCount: count };
            })
        );
        res.json({ hallTypes: withCounts });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch hall types', error: err.message });
    }
});

router.get('/:id', roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER), async (req, res) => {
    try {
        const type = await HallType.findOne({ _id: req.params.id, isDeleted: false });
        if (!type) return res.status(404).json({ message: 'Hall type not found' });
        const halls = await Hall.find({ hallTypeId: req.params.id, isDeleted: false })
            .select('hallName floor status housekeepingStatus');
        res.json({ hallType: type, halls });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch hall type', error: err.message });
    }
});

router.post('/', roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER), async (req, res) => {
    try {
        const { name, description, basePricePerHour, maxOccupancy, amenities, images, isPublished } = req.body;
        if (!name?.trim() || !basePricePerHour || !maxOccupancy) {
            return res.status(400).json({ message: 'name, basePricePerHour, and maxOccupancy are required' });
        }
        const existing = await HallType.findOne({ name: name.trim() });
        if (existing) return res.status(409).json({ message: `Hall type "${name}" already exists` });

        const hallType = await HallType.create({
            name: name.trim(),
            description: description || '',
            basePricePerHour: Number(basePricePerHour),
            maxOccupancy: Number(maxOccupancy),
            amenities: Array.isArray(amenities)
                ? amenities.filter(Boolean)
                : amenities ? amenities.split(',').map((s) => s.trim()).filter(Boolean) : [],
            images: Array.isArray(images) ? images : images ? [images] : [],
            isPublished: isPublished !== false,
        });
        res.status(201).json({ message: 'Hall type created', hallType });
    } catch (err) {
        res.status(500).json({ message: 'Failed to create hall type', error: err.message });
    }
});

router.put('/:id', roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER), async (req, res) => {
    try {
        const { name, description, basePricePerHour, maxOccupancy, amenities, images, isPublished } = req.body;
        const update = {};
        if (name !== undefined) update.name = name.trim();
        if (description !== undefined) update.description = description;
        if (basePricePerHour !== undefined) update.basePricePerHour = Number(basePricePerHour);
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

        const hallType = await HallType.findByIdAndUpdate(req.params.id, update, {
            new: true, runValidators: true,
        });
        if (!hallType) return res.status(404).json({ message: 'Hall type not found' });

        // Cascade to physical halls
        const cascade = {};
        if (update.maxOccupancy) cascade.capacity = update.maxOccupancy;
        if (update.basePricePerHour) cascade.pricePerHour = update.basePricePerHour;
        if (update.amenities) cascade.amenities = update.amenities;
        if (update.description) cascade.description = update.description;
        if (Object.keys(cascade).length > 0) {
            await Hall.updateMany({ hallTypeId: req.params.id }, { $set: cascade });
        }

        res.json({ message: 'Hall type updated and synced', hallType });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update hall type', error: err.message });
    }
});

router.delete('/:id', roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN), async (req, res) => {
    try {
        const hallCount = await Hall.countDocuments({ hallTypeId: req.params.id, isDeleted: false });
        if (hallCount > 0) {
            return res.status(400).json({
                message: `Cannot delete — ${hallCount} hall(s) still use this type.`,
            });
        }
        const hallType = await HallType.findByIdAndUpdate(
            req.params.id, { isDeleted: true, isPublished: false }, { new: true }
        );
        if (!hallType) return res.status(404).json({ message: 'Hall type not found' });
        res.json({ message: 'Hall type deleted' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete hall type', error: err.message });
    }
});

module.exports = router;