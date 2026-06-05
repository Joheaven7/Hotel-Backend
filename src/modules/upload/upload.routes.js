const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/auth');
const { roleCheck } = require('../../middlewares/roleCheck');
const { ROLES } = require('../../config/constants');
const {
    uploadRoomTypeImages,
    uploadHallTypeImages,
    uploadAvatar,
    handleUpload,
    cloudinary,
} = require('../../middlewares/upload');

const RoomType = require('../../models/RoomType');
const HallType = require('../../models/HallType');
const User = require('../../models/User');

// ── POST /api/upload/room-type/:id/images ────────────────────────────────────
// Upload 1-5 images for a room type, save URLs to its images[] array
router.post(
    '/room-type/:id/images',
    authMiddleware,
    roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER),
    handleUpload(uploadRoomTypeImages),
    async (req, res) => {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ message: 'No images uploaded' });
            }

            const urls = req.files.map((f) => f.path); // Cloudinary returns URL in f.path

            const roomType = await RoomType.findByIdAndUpdate(
                req.params.id,
                { $push: { images: { $each: urls } } },
                { new: true }
            );

            if (!roomType) {
                // Clean up uploaded files if type not found
                for (const f of req.files) {
                    await cloudinary.uploader.destroy(f.filename).catch(() => { });
                }
                return res.status(404).json({ message: 'Room type not found' });
            }

            res.json({
                message: `${urls.length} image(s) uploaded successfully`,
                images: urls,
                allImages: roomType.images,
            });
        } catch (error) {
            res.status(500).json({ message: 'Upload failed', error: error.message });
        }
    }
);

// ── DELETE /api/upload/room-type/:id/images ──────────────────────────────────
// Remove a specific image URL from a room type (also deletes from Cloudinary)
router.delete(
    '/room-type/:id/images',
    authMiddleware,
    roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER),
    async (req, res) => {
        try {
            const { imageUrl } = req.body;
            if (!imageUrl) return res.status(400).json({ message: 'imageUrl is required' });

            // Extract public_id from URL for Cloudinary deletion
            const publicId = extractPublicId(imageUrl);
            if (publicId) {
                await cloudinary.uploader.destroy(publicId).catch(() => { });
            }

            const roomType = await RoomType.findByIdAndUpdate(
                req.params.id,
                { $pull: { images: imageUrl } },
                { new: true }
            );

            if (!roomType) return res.status(404).json({ message: 'Room type not found' });

            res.json({ message: 'Image removed', allImages: roomType.images });
        } catch (error) {
            res.status(500).json({ message: 'Failed to remove image', error: error.message });
        }
    }
);

// ── POST /api/upload/hall-type/:id/images ────────────────────────────────────
router.post(
    '/hall-type/:id/images',
    authMiddleware,
    roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER),
    handleUpload(uploadHallTypeImages),
    async (req, res) => {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ message: 'No images uploaded' });
            }

            const urls = req.files.map((f) => f.path);

            const hallType = await HallType.findByIdAndUpdate(
                req.params.id,
                { $push: { images: { $each: urls } } },
                { new: true }
            );

            if (!hallType) {
                for (const f of req.files) {
                    await cloudinary.uploader.destroy(f.filename).catch(() => { });
                }
                return res.status(404).json({ message: 'Hall type not found' });
            }

            res.json({
                message: `${urls.length} image(s) uploaded`,
                images: urls,
                allImages: hallType.images,
            });
        } catch (error) {
            res.status(500).json({ message: 'Upload failed', error: error.message });
        }
    }
);

// ── DELETE /api/upload/hall-type/:id/images ──────────────────────────────────
router.delete(
    '/hall-type/:id/images',
    authMiddleware,
    roleCheck(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER),
    async (req, res) => {
        try {
            const { imageUrl } = req.body;
            if (!imageUrl) return res.status(400).json({ message: 'imageUrl is required' });

            const publicId = extractPublicId(imageUrl);
            if (publicId) await cloudinary.uploader.destroy(publicId).catch(() => { });

            const hallType = await HallType.findByIdAndUpdate(
                req.params.id,
                { $pull: { images: imageUrl } },
                { new: true }
            );

            if (!hallType) return res.status(404).json({ message: 'Hall type not found' });

            res.json({ message: 'Image removed', allImages: hallType.images });
        } catch (error) {
            res.status(500).json({ message: 'Failed to remove image', error: error.message });
        }
    }
);

// ── POST /api/upload/avatar ──────────────────────────────────────────────────
// Upload user profile avatar — any authenticated user
router.post(
    '/avatar',
    authMiddleware,
    handleUpload(uploadAvatar),
    async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ message: 'No image uploaded' });

            const avatarUrl = req.file.path;

            // Remove old avatar from Cloudinary if exists
            const user = await User.findById(req.user._id);
            if (user?.avatar) {
                const oldId = extractPublicId(user.avatar);
                if (oldId) await cloudinary.uploader.destroy(oldId).catch(() => { });
            }

            const updated = await User.findByIdAndUpdate(
                req.user._id,
                { avatar: avatarUrl },
                { new: true }
            ).select('-password -refreshToken');

            res.json({
                message: 'Avatar uploaded successfully',
                avatarUrl,
                user: updated,
            });
        } catch (error) {
            res.status(500).json({ message: 'Avatar upload failed', error: error.message });
        }
    }
);

// ── Utility: extract Cloudinary public_id from URL ───────────────────────────
function extractPublicId(url) {
    try {
        // Cloudinary URL format: https://res.cloudinary.com/cloud/image/upload/v123/folder/public_id.ext
        const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

module.exports = router;