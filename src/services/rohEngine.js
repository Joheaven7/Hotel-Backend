const Room = require('../models/Room');
const Hall = require('../models/Hall');
const RoomType = require('../models/RoomType');
const HallType = require('../models/HallType');
const Reservation = require('../models/Reservation');
const Maintenance = require('../models/Maintenance');
const { acquireLock, releaseLock } = require('../utils/lockingService');

/**
 * Find and lock an available room for the given type and dates.
 *
 * @returns {object} { room, lockKey, lockValue } on success
 * @returns {object} { error, recommendations } when no room available
 */
const findAndLockRoom = async ({ roomTypeId, checkIn, checkOut, numberOfGuests }) => {
    // Step 1 — find all physical rooms of this type
    const candidates = await Room.find({
        roomTypeId,
        status: { $nin: ['MAINTENANCE', 'BLOCKED'] },
        isDeleted: { $ne: true },
        isActive: true,
        // Spec §4-A-4: Only CLEAN rooms are eligible for auto-allocation
        housekeepingStatus: 'CLEAN',
        ...(numberOfGuests ? { capacity: { $gte: parseInt(numberOfGuests) } } : {}),
    }).populate('roomTypeId', 'name basePricePerNight maxOccupancy');

    if (candidates.length === 0) {
        return {
            error: 'NO_CLEAN_ROOMS',
            message: 'No clean rooms of this type are currently available.',
            recommendations: await buildRoomRecommendations(roomTypeId, checkIn, checkOut, numberOfGuests),
        };
    }

    // Step 2 — find which candidates have no conflicting active reservation
    const conflictingRoomIds = (await Reservation.find({
        roomId: { $in: candidates.map(r => r._id) },
        status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
        checkInDate: { $lt: checkOut },
        checkOutDate: { $gt: checkIn },
    }).distinct('roomId')).map(id => id.toString());

    // Filter out rooms with active maintenance overlapping the requested dates
    const conflictingMaintenanceRoomIds = (await Maintenance.find({
        roomId: { $in: candidates.map(r => r._id) },
        status: { $in: ['OPEN', 'IN_PROGRESS'] },
        $or: [
            {
                startDate: { $lt: checkOut },
                endDate: { $gt: checkIn }
            },
            {
                startDate: { $lt: checkOut },
                endDate: { $exists: false }
            },
            {
                startDate: { $lt: checkOut },
                endDate: null
            },
            {
                startDate: null,
                createdAt: { $lt: checkOut }
            },
            {
                startDate: { $exists: false },
                createdAt: { $lt: checkOut }
            },
            {
                blocksDates: {
                    $elemMatch: {
                        $gte: checkIn,
                        $lt: checkOut
                    }
                }
            }
        ]
    }).distinct('roomId')).map(id => id.toString());

    const available = candidates.filter(r => 
        !conflictingRoomIds.includes(r._id.toString()) &&
        !conflictingMaintenanceRoomIds.includes(r._id.toString())
    );

    if (available.length === 0) {
        return {
            error: 'FULLY_BOOKED',
            message: 'All rooms of this type are booked or under maintenance for the selected dates.',
            recommendations: await buildRoomRecommendations(roomTypeId, checkIn, checkOut, numberOfGuests),
        };
    }

    // Step 3 — pessimistic lock on the first available room
    // Try each candidate in order until one lock succeeds
    for (const room of available) {
        const lockKey = `roh:room:${room._id}:${checkIn.toISOString()}:${checkOut.toISOString()}`;
        const lockValue = await acquireLock(lockKey, 30); // 30-second lock

        if (lockValue) {
            return { room, lockKey, lockValue };
        }
        // Lock failed = another request is in the process of booking this room
        // Continue to next candidate
    }

    // All candidates got locked by concurrent requests
    return {
        error: 'CONCURRENT_LOCK',
        message: 'All available rooms are being processed by other bookings. Please try again in a moment.',
        recommendations: await buildRoomRecommendations(roomTypeId, checkIn, checkOut, numberOfGuests),
    };
};

/**
 * Same pattern for halls.
 */
const findAndLockHall = async ({ hallTypeId, checkIn, checkOut, numberOfGuests }) => {
    const candidates = await Hall.find({
        hallTypeId,
        status: { $nin: ['MAINTENANCE'] },
        isDeleted: { $ne: true },
        isActive: true,
        housekeepingStatus: 'CLEAN',
        ...(numberOfGuests ? { capacity: { $gte: parseInt(numberOfGuests) } } : {}),
    }).populate('hallTypeId', 'name basePricePerHour maxOccupancy');

    if (candidates.length === 0) {
        return {
            error: 'NO_CLEAN_HALLS',
            message: 'No clean halls of this type are currently available.',
            recommendations: await buildHallRecommendations(hallTypeId, checkIn, checkOut, numberOfGuests),
        };
    }

    const conflictingHallIds = (await Reservation.find({
        hallId: { $in: candidates.map(h => h._id) },
        status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
        checkInDate: { $lt: checkOut },
        checkOutDate: { $gt: checkIn },
    }).distinct('hallId')).map(id => id.toString());

    const available = candidates.filter(h => !conflictingHallIds.includes(h._id.toString()));

    if (available.length === 0) {
        return {
            error: 'FULLY_BOOKED',
            message: 'All halls of this type are booked for the selected dates.',
            recommendations: await buildHallRecommendations(hallTypeId, checkIn, checkOut, numberOfGuests),
        };
    }

    for (const hall of available) {
        const lockKey = `roh:hall:${hall._id}:${checkIn.toISOString()}:${checkOut.toISOString()}`;
        const lockValue = await acquireLock(lockKey, 30);
        if (lockValue) return { hall, lockKey, lockValue };
    }

    return {
        error: 'CONCURRENT_LOCK',
        message: 'All available halls are being processed. Please try again.',
        recommendations: await buildHallRecommendations(hallTypeId, checkIn, checkOut, numberOfGuests),
    };
};

/**
 * Build smart recommendations when a room type is fully booked.
 * Returns: same type/different dates + upsell + lateral alternatives.
 */
const buildRoomRecommendations = async (roomTypeId, checkIn, checkOut, numberOfGuests) => {
    try {
        const requestedType = await RoomType.findById(roomTypeId);
        if (!requestedType) return [];

        const allTypes = await RoomType.find({
            isDeleted: { $ne: true },
            isPublished: true,
            maxOccupancy: { $gte: numberOfGuests || 1 },
        });

        const recommendations = [];

        // Suggest alternative dates for the same type (±3 days earlier)
        const altCheckIn = new Date(checkIn);
        altCheckIn.setDate(altCheckIn.getDate() - 3);
        const altCheckOut = new Date(checkOut);
        altCheckOut.setDate(altCheckOut.getDate() - 3);

        const altDateAvail = await findAndLockRoom({
            roomTypeId, checkIn: altCheckIn, checkOut: altCheckOut, numberOfGuests,
        });
        if (!altDateAvail.error) {
            await releaseLock(altDateAvail.lockKey, altDateAvail.lockValue);
            recommendations.push({
                type: 'ALTERNATIVE_DATE',
                roomTypeId: requestedType._id,
                name: requestedType.name,
                price: requestedType.basePricePerNight,
                suggestion: `Same room available ${altCheckIn.toLocaleDateString()} – ${altCheckOut.toLocaleDateString()}`,
                altCheckIn,
                altCheckOut,
            });
        }

        // Upsell: next price tier up
        const upsell = allTypes
            .filter(t => t._id.toString() !== roomTypeId.toString() && t.basePricePerNight > requestedType.basePricePerNight)
            .sort((a, b) => a.basePricePerNight - b.basePricePerNight)[0];

        if (upsell) {
            const priceDiff = upsell.basePricePerNight - requestedType.basePricePerNight;
            recommendations.push({
                type: 'UPSELL',
                roomTypeId: upsell._id,
                name: upsell.name,
                price: upsell.basePricePerNight,
                suggestion: `Upgrade to ${upsell.name} for only ETB ${priceDiff} more per night`,
                priceDiff,
            });
        }

        // Lateral: similar price (±20%) different type
        const lateral = allTypes.filter(t => {
            if (t._id.toString() === roomTypeId.toString()) return false;
            const ratio = t.basePricePerNight / requestedType.basePricePerNight;
            return ratio >= 0.8 && ratio <= 1.2;
        })[0];

        if (lateral) {
            recommendations.push({
                type: 'LATERAL',
                roomTypeId: lateral._id,
                name: lateral.name,
                price: lateral.basePricePerNight,
                suggestion: `Similar option: ${lateral.name} at ETB ${lateral.basePricePerNight}/night`,
            });
        }

        return recommendations;
    } catch (_) {
        return [];
    }
};

const buildHallRecommendations = async (hallTypeId, checkIn, checkOut, numberOfGuests) => {
    try {
        const requestedType = await HallType.findById(hallTypeId);
        if (!requestedType) return [];

        const allTypes = await HallType.find({
            isDeleted: { $ne: true },
            isPublished: true,
            maxOccupancy: { $gte: numberOfGuests || 1 },
        });

        const recommendations = [];

        const upsell = allTypes
            .filter(t => t._id.toString() !== hallTypeId.toString() && t.basePricePerHour > requestedType.basePricePerHour)
            .sort((a, b) => a.basePricePerHour - b.basePricePerHour)[0];

        if (upsell) {
            recommendations.push({
                type: 'UPSELL',
                hallTypeId: upsell._id,
                name: upsell.name,
                price: upsell.basePricePerHour,
                suggestion: `Upgrade to ${upsell.name} — ETB ${upsell.basePricePerHour}/hr`,
            });
        }

        return recommendations;
    } catch (_) {
        return [];
    }
};

module.exports = { findAndLockRoom, findAndLockHall };