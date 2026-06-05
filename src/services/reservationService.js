const mongoose = require('mongoose');
const Reservation = require('../models/Reservation');
const Room = require('../models/Room');
const Hall = require('../models/Hall');
const { RESERVATION_STATUS, ROOM_STATUS } = require('../config/constants');
const { findAndLockRoom, findAndLockHall } = require('./rohEngine');
const { schedulePendingCancellation, scheduleCheckInReminder, scheduleCheckout } = require('./queueService');
const { logAudit } = require('../middlewares/auditLogger');

const createReservation = async ({ req, reservationData }) => {
  const { roomTypeId, hallTypeId, checkInDate, checkOutDate, numberOfGuests, specialRequests, guestName, guestEmail, guestPhone, isWalkIn } = reservationData;

  const checkIn = new Date(checkInDate);
  const checkOut = new Date(checkOutDate);

  const isStaff = ['STAFF', 'ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(req.user.role);

  let assignedRoom = null;
  let assignedHall = null;
  let lockKey = null;
  let lockValue = null;
  let pricePerUnit = 0;

  if (roomTypeId) {
    const result = await findAndLockRoom({ roomTypeId, checkIn, checkOut, numberOfGuests });
    if (result.error) return result;
    assignedRoom = result.room;
    lockKey = result.lockKey;
    lockValue = result.lockValue;
    pricePerUnit = assignedRoom.roomTypeId?.basePricePerNight || assignedRoom.pricePerNight || 0;
  }

  if (hallTypeId) {
    const result = await findAndLockHall({ hallTypeId, checkIn, checkOut, numberOfGuests });
    if (result.error) return result;
    assignedHall = result.hall;
    lockKey = result.lockKey;
    lockValue = result.lockValue;
    pricePerUnit = assignedHall.hallTypeId?.basePricePerHour || assignedHall.pricePerHour || 0;
  }

  let totalPrice = 0;
  if (assignedRoom) {
    const nights = Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)));
    totalPrice = pricePerUnit * nights;
  }
  if (assignedHall) {
    const hours = Math.max(1, Math.ceil((checkOut - checkIn) / (1000 * 60 * 60)));
    totalPrice = pricePerUnit * hours;
  }

  const reservationNumber = `RES-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const customerId = isWalkIn ? null : req.user._id;
  const resolvedGuestName = isWalkIn ? guestName : `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
  const resolvedGuestEmail = isWalkIn ? guestEmail : req.user.email;
  const resolvedGuestPhone = isWalkIn ? guestPhone : req.user.phone;

  const reservation = new Reservation({
    reservationNumber,
    customerId,
    guestName: resolvedGuestName,
    guestEmail: resolvedGuestEmail,
    guestPhone: resolvedGuestPhone,
    roomTypeId: roomTypeId || null,
    hallTypeId: hallTypeId || null,
    roomId: assignedRoom?._id || null,
    hallId: assignedHall?._id || null,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    numberOfGuests,
    totalPrice,
    status: RESERVATION_STATUS.PENDING,
    specialRequests,
    createdByStaff: isStaff ? req.user._id : null,
    isWalkIn: !!isWalkIn,
  });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await reservation.save({ session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
    if (lockKey && lockValue) {
      const { releaseLock } = require('../utils/lockingService');
      await releaseLock(lockKey, lockValue).catch(() => { });
    }
  }

  await schedulePendingCancellation(reservation._id, new Date(Date.now() + 30 * 60 * 1000));

  logAudit({
    userId: req.user._id,
    user: req.user,
    actionType: 'RESERVATION_CREATE',
    resource: '/api/reservations',
    targetId: reservation._id,
    details: {
      reservationNumber,
      roomId: reservation.roomId,
      hallId: reservation.hallId,
      totalPrice,
      status: reservation.status,
    },
    req,
  });

  return reservation;
};

const confirmReservation = async ({ reservationId, req }) => {
  const reservation = await Reservation.findById(reservationId).populate('customerId roomId hallId');
  if (!reservation) throw new Error('Reservation not found');
  if (reservation.status !== RESERVATION_STATUS.PENDING) {
    return reservation;
  }
  reservation.status = RESERVATION_STATUS.CONFIRMED;
  await reservation.save();
  await scheduleCheckInReminder(reservation._id, reservation.checkInDate);
  await scheduleCheckout(reservation._id, reservation.checkOutDate);
  if (req) {
    logAudit({
      userId: req.user._id,
      user: req.user,
      actionType: 'RESERVATION_CONFIRM',
      resource: req.originalUrl,
      targetId: reservation._id,
      details: { status: reservation.status },
      req,
    });
  }
  return reservation;
};

const cancelReservation = async ({ reservation, reason }) => {
  reservation.status = RESERVATION_STATUS.CANCELLED;
  if (reason) reservation.notes = reason;
  await reservation.save();
  if (reservation.roomId) {
    await Room.findByIdAndUpdate(reservation.roomId._id, {
      status: ROOM_STATUS.AVAILABLE,
      housekeepingStatus: 'CLEAN',
    });
  }
  if (reservation.hallId) {
    await Hall.findByIdAndUpdate(reservation.hallId._id, {
      status: ROOM_STATUS.AVAILABLE,
      housekeepingStatus: 'CLEAN',
    });
  }
  return reservation;
};

module.exports = {
  createReservation,
  confirmReservation,
  cancelReservation,
};
