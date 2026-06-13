const Reservation = require('../../models/Reservation');
const Room = require('../../models/Room');
const Hall = require('../../models/Hall');
const Payment = require('../../models/Payment');
const Maintenance = require('../../models/Maintenance');
const { RESERVATION_STATUS, PAYMENT_STATUS, ROOM_STATUS } = require('../../config/constants');
const { calculateTotalPrice } = require('../../utils/dateHelper');
const { emailQueue } = require('../../services/jobQueue');
const SystemConfig = require('../../models/SystemConfig');
const { createNotification } = require('../../services/notificationService');
const { confirmReservation: confirmReservationService, cancelReservation: cancelReservationService } = require('../../services/reservationService');
const mongoose = require('mongoose');



exports.createReservation = async (req, res) => {
  const startTime = Date.now();
  let lockKey = null;
  let lockValue = null;

  try {
    const {
      // ROH inputs — customer picks type, not a physical room
      roomTypeId,
      hallTypeId,
      // Dates
      checkInDate,
      checkOutDate,
      numberOfGuests,
      specialRequests,
      // Walk-in form fields (front desk only)
      guestName,
      guestEmail,
      guestPhone,
      isWalkIn,
    } = req.body;

    // ── Auth ────────────────────────────────────────────────────────────────
    if (!req.user?._id) {
      return res.status(401).json({ message: 'User must be authenticated' });
    }

    // ── Input validation ────────────────────────────────────────────────────
    if (!roomTypeId && !hallTypeId) {
      return res.status(400).json({ message: 'Either roomTypeId or hallTypeId is required' });
    }

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }
    if (checkIn >= checkOut) {
      return res.status(400).json({ message: 'Check-in must be before check-out' });
    }
    if (!numberOfGuests || numberOfGuests < 1) {
      return res.status(400).json({ message: 'numberOfGuests must be at least 1' });
    }

    // Walk-in front desk: require guest contact details
    const isStaff = ['STAFF', 'ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(req.user.role);
    if (isWalkIn && isStaff) {
      if (!guestName?.trim()) return res.status(400).json({ message: 'Guest legal name is required for walk-in' });
      if (!guestPhone?.trim()) return res.status(400).json({ message: 'Guest phone number is required for walk-in' });
      if (!guestEmail?.trim()) return res.status(400).json({ message: 'Guest email is required for walk-in' });
    }

    // ── ROH Engine: auto-assign physical unit ───────────────────────────────
    let assignedRoom = null;
    let assignedHall = null;
    let pricePerUnit = 0;

    if (roomTypeId) {
      const result = await findAndLockRoom({ roomTypeId, checkIn, checkOut, numberOfGuests });

      if (result.error) {
        // Fully booked — return recommendations
        return res.status(409).json({
          message: result.message,
          fullyBooked: true,
          recommendations: result.recommendations,
        });
      }

      assignedRoom = result.room;
      lockKey = result.lockKey;
      lockValue = result.lockValue;
      pricePerUnit = assignedRoom.roomTypeId?.basePricePerNight || assignedRoom.pricePerNight || 0;
    }

    if (hallTypeId) {
      const result = await findAndLockHall({ hallTypeId, checkIn, checkOut, numberOfGuests });

      if (result.error) {
        return res.status(409).json({
          message: result.message,
          fullyBooked: true,
          recommendations: result.recommendations,
        });
      }

      assignedHall = result.hall;
      lockKey = result.lockKey;
      lockValue = result.lockValue;
      pricePerUnit = assignedHall.hallTypeId?.basePricePerHour || assignedHall.pricePerHour || 0;
    }

    // ── Price calculation ────────────────────────────────────────────────────
    let totalPrice = 0;
    if (assignedRoom) {
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
      totalPrice = pricePerUnit * nights;
    }
    if (assignedHall) {
      const hours = Math.max(0, (checkOut - checkIn) / (1000 * 60 * 60));
      totalPrice = pricePerUnit * hours;
    }

    // ── Transaction ──────────────────────────────────────────────────────────
    let dbSession = null;
    let useTransaction = true;
    try {
      dbSession = await mongoose.startSession();
      dbSession.startTransaction();
    } catch (_) {
      useTransaction = false;
    }

    try {
      const reservationNumber = `RES-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Determine customer info
      const customerId = (!isWalkIn) ? req.user._id : null;
      const resolvedGuestName = isWalkIn ? guestName : `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
      const resolvedGuestEmail = isWalkIn ? guestEmail : req.user.email;
      const resolvedGuestPhone = isWalkIn ? guestPhone : req.user.phone;

      const newReservation = new Reservation({
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

      if (useTransaction) await newReservation.save({ session: dbSession });
      else await newReservation.save();

      await newReservation.populate([
        { path: 'customerId', select: 'firstName lastName email phone' },
        { path: 'roomId', select: 'roomNumber floor housekeepingStatus', populate: { path: 'roomTypeId', select: 'name basePricePerNight' } },
        { path: 'hallId', select: 'hallName floor', populate: { path: 'hallTypeId', select: 'name basePricePerHour' } },
        { path: 'roomTypeId', select: 'name basePricePerNight' },
        { path: 'hallTypeId', select: 'name basePricePerHour' },
        { path: 'createdByStaff', select: 'firstName lastName employeeId' },
      ]);

      // Create payment record
      const paymentNumber = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const customerEmail = resolvedGuestEmail;
      const customerName = resolvedGuestName;
      const customerPhone = resolvedGuestPhone;

      const payment = new Payment({
        paymentNumber,
        reservation: newReservation._id,
        amount: totalPrice,
        currency: 'ETB',
        paymentMethod: 'CHAPA',
        status: PAYMENT_STATUS.PENDING,
        customerEmail,
        customerPhone,
        customerName,
        paymentDescription: `Payment for reservation ${reservationNumber}`,
      });

      if (useTransaction) await payment.save({ session: dbSession });
      else await payment.save();

      if (useTransaction) {
        await dbSession.commitTransaction();
        dbSession.endSession();
      }

      // ── Release lock ──────────────────────────────────────────────────────
      if (lockKey && lockValue) {
        await releaseLock(lockKey, lockValue);
        lockKey = lockValue = null;
      }

      // ── Email ─────────────────────────────────────────────────────────────
      if (customerEmail) {
        const roomLabel = assignedRoom
          ? `${newReservation.roomTypeId?.name || 'Room'} — Floor ${assignedRoom.floor || 'N/A'}`
          : assignedHall
            ? `${newReservation.hallTypeId?.name || 'Hall'}`
            : 'N/A';

        emailQueue.add({
          email: customerEmail,
          templateName: 'bookingConfirmation',
          data: {
            reservation: newReservation,
            customer: { name: customerName, email: customerEmail, phone: customerPhone },
            roomLabel,
            floorLevel: assignedRoom?.floor || assignedHall?.floor || 'N/A',
            assignedRoomNumber: assignedRoom?.roomNumber || assignedHall?.hallName || 'N/A',
          },
        }).catch(() => { });
      }

      // ── Socket: targeted broadcast to ADMIN + STAFF roles ─────────────────
      const roomLabel = assignedRoom
        ? `Room ${assignedRoom.roomNumber} (${newReservation.roomTypeId?.name || newReservation.roomId?.type || 'Room'})`
        : assignedHall
          ? `Hall ${assignedHall.hallName}`
          : 'N/A';

      const socketPayload = {
        reservation: newReservation,
        payment,
        message: `New Booking: ${roomLabel} locked and reserved by ${customerName}`,
      };

      if (req.io) {
        // Broadcast to ADMIN and STAFF dashboards — not all users
        req.io.to('role:ADMIN').to('role:SUPER_ADMIN').to('role:MANAGER').to('role:STAFF').emit('reservation:created', socketPayload);
      }

      // ── In-app notification ───────────────────────────────────────────────
      createNotification(req.io, {
        title: `New Booking: ${roomLabel}`,
        message: `${customerName} has reserved ${roomLabel} from ${checkIn.toLocaleDateString()} to ${checkOut.toLocaleDateString()}.`,
        type: 'RESERVATION_CREATED',
        targetRoles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF'],
        resourceId: newReservation._id,
        resourceType: 'Reservation',
      });

      // Personal confirmation notification for logged-in customer
      if (customerId) {
        createNotification(req.io, {
          title: 'Booking Confirmed',
          message: `Your reservation ${reservationNumber} has been received. ${roomLabel} is held for you.`,
          type: 'RESERVATION_CREATED',
          userId: customerId,
          resourceId: newReservation._id,
          resourceType: 'Reservation',
        });
      }

      res.status(201).json({
        message: 'Reservation created successfully',
        reservation: newReservation,
        payment,
        assignedRoom: assignedRoom ? {
          roomNumber: assignedRoom.roomNumber,
          floor: assignedRoom.floor,
          typeName: newReservation.roomTypeId?.name,
        } : null,
        assignedHall: assignedHall ? {
          hallName: assignedHall.hallName,
          floor: assignedHall.floor,
          typeName: newReservation.hallTypeId?.name,
        } : null,
      });

    } catch (innerError) {
      if (useTransaction && dbSession) {
        try { await dbSession.abortTransaction(); dbSession.endSession(); } catch (_) { }
      }
      throw innerError;
    }

  } catch (error) {
    // Always release lock on failure
    if (lockKey && lockValue) {
      await releaseLock(lockKey, lockValue).catch(() => { });
    }
    if (!res.headersSent) {
      res.status(500).json({
        message: 'Failed to create reservation',
        error: error.message,
      });
    }
  }
};
// Get all reservations - FIX: use consistent field names for the frontend
exports.getAllReservations = async (req, res) => {
  try {
    const { role, _id: userId } = req.user;
    const { showDeleted } = req.query;

    let filter = {};

    // Customers only see their own reservations
    if (role === 'CUSTOMER') {
      filter.customerId = userId;
    }

    // By default exclude soft-deleted; SUPER_ADMIN can toggle to see deleted
    if (showDeleted === 'true' && role === 'SUPER_ADMIN') {
      filter.deleted = true;
    } else {
      filter.deleted = { $ne: true };
    }

    const reservations = await Reservation.find(filter)
      .populate('customerId', 'firstName lastName email phone')
      .populate('roomId', 'roomNumber type pricePerNight')
      .populate('hallId', 'hallName capacity')
      .populate('deletedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    const transformedReservations = reservations.map(r => ({
      ...r.toObject(),
      customer: r.customerId,
      room: r.roomId,
      hall: r.hallId,
    }));

    res.json({
      message: 'Reservations retrieved successfully',
      reservations: transformedReservations,
      total: transformedReservations.length,
    });
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({
      message: 'Error fetching reservations',
      error: error.message,
    });
  }
};

// Get reservation by ID - with ownership check
exports.getReservationById = async (req, res) => {
  try {
    const { reservationId } = req.params;
    const { role, _id: userId } = req.user;

    const reservation = await Reservation.findById(reservationId)
      .populate('customerId')
      .populate('roomId')
      .populate('hallId');

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    // Customers can only view their own reservations
    if (role === 'CUSTOMER' && (!reservation.customerId || reservation.customerId._id.toString() !== userId.toString())) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const transformed = {
      ...reservation.toObject(),
      customer: reservation.customerId,
      room: reservation.roomId,
      hall: reservation.hallId,
    };

    res.json({
      message: 'Reservation retrieved successfully',
      reservation: transformed,
    });
  } catch (error) {
    console.error('Error fetching reservation:', error);
    res.status(500).json({
      message: 'Error fetching reservation',
      error: error.message,
    });
  }
};

// Confirm reservation
exports.confirmReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;
    const reservation = await confirmReservationService({ reservationId, req });

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    if (req.io) {
      req.io.emit('reservation:confirmed', reservation);
    }

    res.json({
      message: 'Reservation confirmed',
      reservation,
    });

    createNotification(req.io, {
      title: 'Reservation Confirmed',
      message: `Reservation ${reservation.reservationNumber} has been confirmed.`,
      type: 'RESERVATION_CONFIRMED',
      userId: reservation.customerId?._id || reservation.customerId,
      resourceId: reservation._id,
      resourceType: 'Reservation',
    });

  } catch (error) {
    console.error('Error confirming reservation:', error);
    res.status(500).json({
      message: 'Error confirming reservation',
      error: error.message,
    });
  }
};

// Check-in
exports.checkInReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;

    const reservation = await Reservation.findById(reservationId);

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    if (reservation.status !== RESERVATION_STATUS.CONFIRMED && reservation.status !== RESERVATION_STATUS.PENDING) {
      return res.status(400).json({
        message: `Cannot check in — reservation status is ${reservation.status}`,
      });
    }

    reservation.status = RESERVATION_STATUS.CHECKED_IN;
    reservation.checkedInAt = new Date();
    await reservation.save();

    await reservation.populate('customerId roomId hallId');

    if (reservation.roomId) {
      await Room.findByIdAndUpdate(reservation.roomId._id, {
        status: ROOM_STATUS.OCCUPIED,
        housekeepingStatus: 'CLEAN',
      });
    }

    if (req.io) {
      req.io.emit('reservation:checkedIn', reservation);
    }

    res.json({
      message: 'Check-in successful',
      reservation,
    });
  } catch (error) {
    console.error('Error checking in:', error);
    res.status(500).json({
      message: 'Error checking in',
      error: error.message,
    });
  }
};

// Check-out
exports.checkOutReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;

    const reservation = await Reservation.findById(reservationId)
      .populate('customerId', 'firstName lastName email phone')
      .populate('roomId', 'roomNumber floor housekeepingStatus')
      .populate('hallId', 'hallName floor')
      .populate('roomTypeId', 'name');

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    if (reservation.status !== RESERVATION_STATUS.CHECKED_IN) {
      return res.status(400).json({
        message: `Cannot check out — reservation status is ${reservation.status}`,
      });
    }

    reservation.status = RESERVATION_STATUS.CHECKED_OUT;
    reservation.checkedOutAt = new Date();
    await reservation.save();

    // Room → AVAILABLE but DIRTY (must be cleaned before re-booking)
    if (reservation.roomId) {
      await Room.findByIdAndUpdate(reservation.roomId._id, {
        status: ROOM_STATUS.AVAILABLE,
        housekeepingStatus: 'DIRTY',
      });

      // Notify housekeeping
      createNotification(req.io, {
        title: 'Room Needs Cleaning',
        message: `Room ${reservation.roomId.roomNumber} is dirty after guest checkout — please clean before next booking.`,
        type: 'MAINTENANCE_UPDATED',
        targetRoles: ['STAFF', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'],
        resourceId: reservation.roomId._id,
        resourceType: 'Room',
      });

      // Real-time room state update
      if (req.io) {
        req.io.to('role:STAFF').to('role:ADMIN').to('role:MANAGER').emit('room:dirty', {
          roomId: reservation.roomId._id,
          roomNumber: reservation.roomId.roomNumber,
          floor: reservation.roomId.floor,
          reason: 'Manual checkout',
        });
      }
    }

    // Hall → AVAILABLE + DIRTY
    if (reservation.hallId) {
      await Hall.findByIdAndUpdate(reservation.hallId._id, {
        status: 'AVAILABLE',
        housekeepingStatus: 'DIRTY',
      });
    }

    // Checkout confirmation email
    if (reservation.customerId?.email || reservation.guestEmail) {
      const email = reservation.customerId?.email || reservation.guestEmail;
      emailQueue.add({
        email,
        templateName: 'checkoutConfirmation',
        data: {
          reservation,
          customer: reservation.customerId || {
            name: reservation.guestName,
            email: reservation.guestEmail,
          },
        },
      }).catch(() => { });
    }

    // Targeted socket broadcast
    if (req.io) {
      req.io.to('role:ADMIN').to('role:MANAGER').to('role:STAFF').to('role:SUPER_ADMIN').emit('reservation:checkedOut', {
        reservationId: reservation._id,
        guestName: reservation.customerId
          ? `${reservation.customerId.firstName} ${reservation.customerId.lastName}`
          : reservation.guestName || 'Guest',
        roomNumber: reservation.roomId?.roomNumber || null,
        checkedOutAt: reservation.checkedOutAt,
      });
    }

    res.json({ message: 'Check-out successful', reservation });
  } catch (error) {
    res.status(500).json({ message: 'Error checking out', error: error.message });
  }
};

// Cancel reservation
exports.cancelReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;
    const { reason } = req.body;
    const { role, _id: userId } = req.user;

    const reservation = await Reservation.findById(reservationId)
      .populate('customerId')
      .populate('roomId')
      .populate('hallId');

    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    // CUSTOMER: can only cancel their own reservations
    if (role === 'CUSTOMER' && (!reservation.customerId || reservation.customerId._id.toString() !== userId.toString())) {
      return res.status(403).json({ message: 'You can only cancel your own reservations' });
    }

    // STAFF: cannot cancel reservations
    if (role === 'STAFF') {
      return res.status(403).json({ message: 'Staff cannot cancel reservations' });
    }

    if (![RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED].includes(reservation.status)) {
      return res.status(400).json({
        message: `Cannot cancel a ${reservation.status} reservation`,
      });
    }

    const cancelledReservation = await cancelReservationService({ reservation, reason });

    const payment = await Payment.findOne({ reservation: reservationId });
    if (payment && payment.status === PAYMENT_STATUS.PENDING) {
      payment.status = PAYMENT_STATUS.REFUNDED;
      await payment.save();
    }

    createNotification(req.io, {
      title: 'Reservation Cancelled',
      message: `Reservation ${cancelledReservation.reservationNumber} has been cancelled.`,
      type: 'RESERVATION_CANCELLED',
      targetRoles: ['SUPER_ADMIN', 'ADMIN'],
      userId: cancelledReservation.customerId?._id || cancelledReservation.customerId,
      resourceId: cancelledReservation._id,
      resourceType: 'Reservation',
    });

    if (cancelledReservation.customerId?.email) {
      emailQueue.add({
        email: cancelledReservation.customerId.email,
        templateName: 'cancellationConfirmation',
        data: { reservation: cancelledReservation, customer: cancelledReservation.customerId }
      }).catch(err => console.error('Email queue error:', err.message));
    }

    if (req.io) {
      req.io.emit('reservation:cancelled', {
        reservation: cancelledReservation,
        cancelledBy: userId,
      });
    }

    res.json({
      message: 'Reservation cancelled successfully',
      reservation: cancelledReservation,
      payment,
    });

  } catch (error) {
    console.error('Error cancelling reservation:', error);
    res.status(500).json({
      message: 'Failed to cancel reservation',
      error: error.message,
    });
  }
};

// Get availability calendar - FIXED: use roomId instead of room
exports.getAvailabilityCalendar = async (req, res) => {
  try {
    const { roomId, startDate, endDate } = req.query;

    if (!roomId || !startDate || !endDate) {
      return res.status(400).json({
        message: 'roomId, startDate, and endDate are required',
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // FIXED: use roomId field instead of room
    const reservations = await Reservation.find({
      roomId: roomId,
      status: { $in: [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED, RESERVATION_STATUS.CHECKED_IN] },
      checkInDate: { $lt: end },
      checkOutDate: { $gt: start },
    });

    const availability = [];
    const current = new Date(start);

    while (current < end) {
      const isBooked = reservations.some(
        (res) => res.checkInDate <= current && res.checkOutDate > current
      );

      availability.push({
        date: new Date(current),
        available: !isBooked,
      });

      current.setDate(current.getDate() + 1);
    }

    res.json({
      message: 'Availability retrieved',
      availability,
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({
      message: 'Error fetching availability',
      error: error.message,
    });
  }
};

// Get reviews
exports.getReviews = async (req, res) => {
  try {
    // Return empty array to trigger the frontend's static reviews fallback cleanly
    res.json({
      success: true,
      reviews: [],
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      message: 'Error fetching reviews',
      error: error.message,
    });
  }
};

// ── Soft delete reservation (SUPER_ADMIN only) ─────────────────────────────
exports.deleteReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;

    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    if (reservation.deleted) {
      return res.status(400).json({ message: 'Reservation is already deleted' });
    }

    reservation.deleted = true;
    reservation.deletedAt = new Date();
    reservation.deletedBy = req.user._id;
    await reservation.save();

    if (req.io) {
      req.io.emit('reservation:deleted', { reservationId: reservation._id });
    }

    createNotification(req.io, {
      title: 'Reservation Deleted',
      message: `Reservation ${reservation.reservationNumber} has been soft-deleted by admin.`,
      type: 'RESERVATION_CANCELLED',
      targetRoles: ['SUPER_ADMIN', 'ADMIN'],
      resourceId: reservation._id,
      resourceType: 'Reservation',
    });

    res.json({ message: 'Reservation deleted successfully', reservationId: reservation._id });
  } catch (error) {
    console.error('Error deleting reservation:', error);
    res.status(500).json({ message: 'Failed to delete reservation', error: error.message });
  }
};

// ── Undo soft delete reservation (SUPER_ADMIN only) ────────────────────────
exports.undoDeleteReservation = async (req, res) => {
  try {
    const { reservationId } = req.params;

    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    if (!reservation.deleted) {
      return res.status(400).json({ message: 'Reservation is not deleted' });
    }

    reservation.deleted = false;
    reservation.deletedAt = null;
    reservation.deletedBy = null;
    await reservation.save();

    if (req.io) {
      req.io.emit('reservation:restored', { reservationId: reservation._id });
    }

    res.json({ message: 'Reservation restored successfully', reservationId: reservation._id });
  } catch (error) {
    console.error('Error restoring reservation:', error);
    res.status(500).json({ message: 'Failed to restore reservation', error: error.message });
  }
};

module.exports = exports;