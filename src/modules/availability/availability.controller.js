const { findAndLockRoom, findAndLockHall } = require('../../services/rohEngine');
const { releaseLock } = require('../../utils/lockingService');

exports.checkAvailability = async (req, res) => {
    try {
        const { typeId, category, checkIn, checkOut, guests } = req.body;

        if (!typeId || !category || !checkIn || !checkOut) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);

        if (checkInDate >= checkOutDate) {
            return res.status(400).json({ message: 'Check-in must be before check-out' });
        }

        let result;
        if (category.toUpperCase() === 'ROOM') {
            result = await findAndLockRoom({
                roomTypeId: typeId,
                checkIn: checkInDate,
                checkOut: checkOutDate,
                numberOfGuests: guests || 1
            });
        } else if (category.toUpperCase() === 'HALL') {
            result = await findAndLockHall({
                hallTypeId: typeId,
                checkIn: checkInDate,
                checkOut: checkOutDate,
                numberOfGuests: guests || 1
            });
        } else {
            return res.status(400).json({ message: 'Invalid category' });
        }

        // Release the lock immediately since this is just a check
        if (result.lockKey && result.lockValue) {
            await releaseLock(result.lockKey, result.lockValue).catch(() => {});
        }

        if (result.error) {
            return res.json({
                available: false,
                availableUnits: [],
                suggestions: result.recommendations || []
            });
        }

        return res.json({
            available: true,
            availableUnits: [result.room || result.hall],
            suggestions: []
        });

    } catch (error) {
        console.error('Error checking availability:', error);
        res.status(500).json({ message: 'Failed to check availability', error: error.message });
    }
};
