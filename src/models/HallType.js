const mongoose = require('mongoose');

const hallTypeSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Hall type name is required'],
            unique: true,
            trim: true,
        },
        slug: {
            type: String,
            unique: true,
            lowercase: true,
            trim: true,
        },
        description: { type: String, default: '' },
        basePricePerHour: {
            type: Number,
            required: [true, 'Base price per hour is required'],
            min: 0,
        },
        maxOccupancy: {
            type: Number,
            required: [true, 'Max occupancy is required'],
            min: 1,
        },
        amenities: [{ type: String, trim: true }],
        images: [{ type: String }],
        isPublished: { type: Boolean, default: true },
        isDeleted: { type: Boolean, default: false },
    },
    { timestamps: true }
);

hallTypeSchema.pre('save', function (next) {
    if (this.isModified('name') || this.isNew) {
        this.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');
    }
    next();
});

module.exports = mongoose.model('HallType', hallTypeSchema);