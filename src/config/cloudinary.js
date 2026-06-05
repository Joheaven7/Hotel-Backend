const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Test connection on startup (non-blocking)
cloudinary.api.ping()
    .then(() => console.info('[Cloudinary] Connected ✓'))
    .catch((err) => console.warn('[Cloudinary] Not connected:', err.message, '— image uploads will fail'));

module.exports = cloudinary;