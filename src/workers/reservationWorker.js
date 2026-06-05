const Reservation = require('../models/Reservation');
const Room = require('../models/Room');
const Hall = require('../models/Hall');
const { RESERVATION_STATUS, ROOM_STATUS } = require('../config/constants');
const { createNotification } = require('../services/notificationService');

const releaseResource = async (reservation) => {
  if (reservation.roomId) {
    await Room.findByIdAndUpdate(reservation.roomId, {
      status: ROOM_STATUS.AVAILABLE,
      housekeepingStatus: 'CLEAN',
    });
  }
  if (reservation.hallId) {
    await Hall.findByIdAndUpdate(reservation.hallId, {
      status: ROOM_STATUS.AVAILABLE,
      housekeepingStatus: 'CLEAN',
    });
  }
};

const processReservationJob = async (job) => {
  const { reservationId } = job.data;
  const reservation = await Reservation.findById(reservationId)
    .populate('customerId', 'firstName lastName email')
    .populate('roomId', 'roomNumber floor')
    .populate('hallId', 'hallName floor');

  if (!reservation) {
    return;
  }

  if (job.name === 'autoCancelPending') {
    if (reservation.status !== RESERVATION_STATUS.PENDING) return;
    reservation.status = RESERVATION_STATUS.CANCELLED;
    await reservation.save();
    await releaseResource(reservation);
    await createNotification(null, {
      title: 'Reservation Cancelled',
      message: `Reservation ${reservation.reservationNumber} was automatically cancelled after payment was not completed.`,
      type: 'RESERVATION_CANCELLED',
      targetRoles: ['SUPER_ADMIN', 'ADMIN'],
      resourceId: reservation._id,
      resourceType: 'Reservation',
    });
    return;
  }

  if (job.name === 'checkInReminder') {
    if (reservation.status !== RESERVATION_STATUS.CONFIRMED) return;
    if (reservation.reminderSent) return;

    const guestName = reservation.customerId
      ? `${reservation.customerId.firstName} ${reservation.customerId.lastName}`
      : reservation.guestName || 'Guest';

    await Reservation.findByIdAndUpdate(reservation._id, { reminderSent: true });
    await createNotification(null, {
      title: 'Check-in Reminder',
      message: `${guestName} is expected to arrive at ${new Date(reservation.checkInDate).toLocaleTimeString()}.`,
      type: 'RESERVATION_CHECKIN',
      targetRoles: ['STAFF', 'MANAGER', 'ADMIN'],
      resourceId: reservation._id,
      resourceType: 'Reservation',
    });
    return;
  }

  if (job.name === 'autoCheckout') {
    if (reservation.status !== RESERVATION_STATUS.CHECKED_IN) return;
    if (new Date(reservation.checkOutDate) > new Date()) return;

    reservation.status = RESERVATION_STATUS.CHECKED_OUT;
    reservation.checkedOutAt = new Date();
    await reservation.save();
    await releaseResource(reservation);
    await createNotification(null, {
      title: 'Auto Checkout Completed',
      message: `Reservation ${reservation.reservationNumber} has been automatically checked out at the scheduled time.`,
      type: 'RESERVATION_CHECKOUT',
      targetRoles: ['STAFF', 'MANAGER', 'ADMIN'],
      resourceId: reservation._id,
      resourceType: 'Reservation',
    });
    return;
  }
};

module.exports = { processReservationJob };
