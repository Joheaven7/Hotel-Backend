const cron = require('node-cron');
const Reservation = require('../models/Reservation');
const Room = require('../models/Room');
const Hall = require('../models/Hall');
const { createNotification } = require('./notificationService');
const { RESERVATION_STATUS } = require('../config/constants');

/**
 * Initialize all cron jobs.
 * Call once from server.js after DB connects.
 * @param {object} io - socket.io server instance
 */
const initCronJobs = (io) => {

    // ── Job 1: Auto checkout + room dirty ─────────────────────────────────────
    // Runs every 5 minutes.
    // Finds CHECKED_IN reservations whose checkout time has passed → auto checkout
    cron.schedule('*/5 * * * *', async () => {
        try {
            const now = new Date();

            const overdueReservations = await Reservation.find({
                status: RESERVATION_STATUS.CHECKED_IN,
                checkOutDate: { $lte: now },
                $or: [{ roomId: { $ne: null } }, { hallId: { $ne: null } }],
            })
                .populate('roomId', 'roomNumber floor housekeepingStatus')
                .populate('hallId', 'hallName floor')
                .populate('customerId', 'firstName lastName email');

            if (overdueReservations.length === 0) return;

            for (const reservation of overdueReservations) {
                if (!reservation.roomId && !reservation.hallId) {
                    console.warn('[CRON] Skipping invalid auto checkout reservation:', reservation._id.toString());
                    continue;
                }

                // Transition: CHECKED_IN → CHECKED_OUT
                reservation.status = RESERVATION_STATUS.CHECKED_OUT;
                reservation.checkedOutAt = now;
                await reservation.save();

                // Transition room: OCCUPIED → housekeepingStatus DIRTY
                if (reservation.roomId) {
                    await Room.findByIdAndUpdate(reservation.roomId._id, {
                        status: 'AVAILABLE', // back in pool but dirty
                        housekeepingStatus: 'DIRTY',
                        $unset: { lastCleanedAt: '' },
                    });

                    // Notify housekeeping staff
                    createNotification(io, {
                        title: `Room Needs Cleaning`,
                        message: `Room ${reservation.roomId.roomNumber} (Floor ${reservation.roomId.floor || '—'}) is now dirty after guest checkout.`,
                        type: 'MAINTENANCE_UPDATED',
                        targetRoles: ['STAFF', 'MANAGER', 'SUPER_ADMIN', 'ADMIN'],
                        resourceId: reservation.roomId._id,
                        resourceType: 'Room',
                    });

                    // Socket: targeted emit to housekeeping dashboard
                    if (io) {
                        io.to('role:STAFF').to('role:ADMIN').to('role:MANAGER').emit('room:dirty', {
                            roomId: reservation.roomId._id,
                            roomNumber: reservation.roomId.roomNumber,
                            floor: reservation.roomId.floor,
                            reason: 'Auto checkout — guest departed',
                        });
                    }
                }

                // Transition hall back to AVAILABLE
                if (reservation.hallId) {
                    await Hall.findByIdAndUpdate(reservation.hallId._id, {
                        status: 'AVAILABLE',
                        housekeepingStatus: 'DIRTY',
                    });
                }

                // Socket: update reservation state across all open dashboards
                if (io) {
                    io.to('role:ADMIN').to('role:MANAGER').to('role:STAFF').to('role:SUPER_ADMIN').emit('reservation:autoCheckout', {
                        reservationId: reservation._id,
                        guestName: reservation.customerId
                            ? `${reservation.customerId.firstName} ${reservation.customerId.lastName}`
                            : reservation.guestName || 'Guest',
                        roomNumber: reservation.roomId?.roomNumber || null,
                        checkedOutAt: now,
                    });
                }
            }

            if (overdueReservations.length > 0) {
                console.info(`[CRON] Auto-checked-out ${overdueReservations.length} reservation(s)`);
            }
        } catch (error) {
            console.error('[CRON] Auto checkout job failed:', error.message);
        }
    });

    // ── Job 2: Auto-confirm PENDING reservations after 30 min ─────────────────
    // Runs every 10 minutes.
    // Reservations that stay PENDING for >30 minutes are auto-confirmed
    // (prevents admin bottleneck on walk-in bookings)
    cron.schedule('*/10 * * * *', async () => {
        try {
            const threshold = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago

            const result = await Reservation.updateMany(
                {
                    status: RESERVATION_STATUS.PENDING,
                    createdAt: { $lte: threshold },
                    isWalkIn: { $ne: true }, // walk-ins need manual confirmation
                },
                { $set: { status: RESERVATION_STATUS.CONFIRMED } }
            );

            if (result.modifiedCount > 0) {
                console.info(`[CRON] Auto-confirmed ${result.modifiedCount} reservation(s)`);
            }
        } catch (error) {
            console.error('[CRON] Auto confirm job failed:', error.message);
        }
    });

    // ── Job 3: Daily summary notification to Manager ───────────────────────────
    // Runs every day at 7:00 AM
    cron.schedule('0 7 * * *', async () => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const [checkInsToday, checkOutsToday, dirtyRooms] = await Promise.all([
                Reservation.countDocuments({
                    status: RESERVATION_STATUS.CONFIRMED,
                    checkInDate: { $gte: today, $lt: tomorrow },
                }),
                Reservation.countDocuments({
                    status: RESERVATION_STATUS.CHECKED_IN,
                    checkOutDate: { $gte: today, $lt: tomorrow },
                }),
                Room.countDocuments({ housekeepingStatus: 'DIRTY' }),
            ]);

            createNotification(io, {
                title: 'Daily Operations Summary',
                message: `Today: ${checkInsToday} check-in(s) expected, ${checkOutsToday} check-out(s) scheduled. ${dirtyRooms} room(s) need cleaning.`,
                type: 'SYSTEM_ALERT',
                targetRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER'],
            });

            console.info(`[CRON] Daily summary sent — checkIns: ${checkInsToday}, checkOuts: ${checkOutsToday}, dirty: ${dirtyRooms}`);
        } catch (error) {
            console.error('[CRON] Daily summary job failed:', error.message);
        }
    });

    // ── Job 4: Reminder 2h before check-in ────────────────────────────────────
    // Runs every 30 minutes.
    // Finds confirmed reservations whose check-in is within the next 2 hours
    cron.schedule('*/30 * * * *', async () => {
        try {
            const now = new Date();
            const twoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);

            const upcoming = await Reservation.find({
                status: RESERVATION_STATUS.CONFIRMED,
                checkInDate: { $gte: now, $lte: twoHours },
                reminderSent: { $ne: true },
            })
                .populate('customerId', 'firstName lastName')
                .populate('roomId', 'roomNumber')
                .populate('roomTypeId', 'name');

            for (const res of upcoming) {
                const guestName = res.customerId
                    ? `${res.customerId.firstName} ${res.customerId.lastName}`
                    : res.guestName || 'Guest';

                // Notify staff to prepare
                createNotification(io, {
                    title: `Check-in in 2 hours`,
                    message: `${guestName} is expected to check in at ${new Date(res.checkInDate).toLocaleTimeString()} — Room ${res.roomId?.roomNumber || 'TBD'}.`,
                    type: 'RESERVATION_CHECKIN',
                    targetRoles: ['STAFF', 'ADMIN', 'MANAGER'],
                    resourceId: res._id,
                    resourceType: 'Reservation',
                });

                // Mark reminder sent so we don't duplicate
                await Reservation.findByIdAndUpdate(res._id, { reminderSent: true });
            }

            if (upcoming.length > 0) {
                console.info(`[CRON] Sent ${upcoming.length} check-in reminder(s)`);
            }
        } catch (error) {
            console.error('[CRON] Check-in reminder job failed:', error.message);
        }
    });

    console.info('[CRON] All jobs initialized ✓');
};

module.exports = { initCronJobs };