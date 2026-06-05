const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

// ── Allowed MIME types ────────────────────────────────────────────────────────
const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp'];

// ── Storage: room-type images → folder 'luxstay/room-types' ─────────────────
const roomTypeStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'luxstay/room-types',
        allowed_formats: ALLOWED_FORMATS,
        transformation: [
            { width: 1200, height: 800, crop: 'fill', quality: 'auto:good' },
        ],
        public_id: (req, file) => {
            const name = file.originalname.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9]/gi, '-');
            return `rt-${Date.now()}-${name}`;
        },
    },
});

// ── Storage: hall-type images → folder 'luxstay/hall-types' ─────────────────
const hallTypeStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'luxstay/hall-types',
        allowed_formats: ALLOWED_FORMATS,
        transformation: [
            { width: 1200, height: 800, crop: 'fill', quality: 'auto:good' },
        ],
        public_id: (req, file) => {
            const name = file.originalname.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9]/gi, '-');
            return `ht-${Date.now()}-${name}`;
        },
    },
});

// ── Storage: user avatars → folder 'luxstay/avatars' ────────────────────────
const avatarStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'luxstay/avatars',
        allowed_formats: ALLOWED_FORMATS,
        transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto:good' },
        ],
        public_id: (req, file) => `avatar-${req.user?._id}-${Date.now()}`,
    },
});

// ── File filter — images only ─────────────────────────────────────────────────
const imageFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (jpg, jpeg, png, webp)'), false);
    }
};

// ── Multer instances ──────────────────────────────────────────────────────────
const uploadRoomTypeImages = multer({
    storage: roomTypeStorage,
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024, files: 5 }, // 5MB per file, max 5 files
}).array('images', 5);

const uploadHallTypeImages = multer({
    storage: hallTypeStorage,
    fileFilter: imageFilter,
    limits: { fileSize: 5 * 1024 * 1024, files: 5 },
}).array('images', 5);

const uploadAvatar = multer({
    storage: avatarStorage,
    fileFilter: imageFilter,
    limits: { fileSize: 2 * 1024 * 1024, files: 1 }, // 2MB, 1 file
}).single('avatar');

// ── Error handler wrapper ─────────────────────────────────────────────────────
// Converts multer callback errors into Express next(err) flow
const handleUpload = (multerFn) => (req, res, next) => {
    multerFn(req, res, (err) => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File too large — maximum 5MB per image' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ message: 'Too many files — maximum 5 images' });
        }
        res.status(400).json({ message: err.message || 'Upload failed' });
    });
};

module.exports = {
    uploadRoomTypeImages,
    uploadHallTypeImages,
    uploadAvatar,
    handleUpload,
    cloudinary,
};