const User = require('../../models/User');
const Room = require('../../models/Room');
const Reservation = require('../../models/Reservation');
const Payment = require('../../models/Payment');
const Payroll = require('../../models/Payroll');
const Maintenance = require('../../models/Maintenance');
const {
  ROLES,
  RESERVATION_STATUS,
  PAYMENT_STATUS,
  MAINTENANCE_STATUS,
} = require('../../config/constants');

// ─── SUPER_ADMIN Dashboard ────────────────────────────────────────────────────
const superAdminDashboard = async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);

    const [
      usersByRole,
      totalRooms,
      occupiedRooms,
      totalReservations,
      totalRevenue,
      pendingPayments,
      monthlyPayroll,
      openMaintenance,
      inProgressMaintenance,
      revenueByMonth,
    ] = await Promise.all([
      User.aggregate([
        { $match: { isActive: true, deletedAt: { $eq: null } } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
      Room.countDocuments({ isActive: true }),
      Room.countDocuments({ status: 'OCCUPIED' }),
      Reservation.countDocuments({
        status: { $ne: RESERVATION_STATUS.CANCELLED },
      }),
      Payment.aggregate([
        { $match: { status: PAYMENT_STATUS.PAID } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Payment.aggregate([
        { $match: { status: PAYMENT_STATUS.PENDING } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Payroll.aggregate([
        { $match: { month: currentMonth } },
        { $group: { _id: null, total: { $sum: '$netSalary' } } },
      ]),
      Maintenance.countDocuments({ status: MAINTENANCE_STATUS.OPEN }),
      Maintenance.countDocuments({ status: MAINTENANCE_STATUS.IN_PROGRESS }),
      Payment.aggregate([
        { $match: { status: PAYMENT_STATUS.PAID, paidAt: { $ne: null, $exists: true } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$paidAt' } },
            revenue: { $sum: '$amount' },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 6 },
      ]),
    ]);

    res.json({
      usersByRole,
      totalRooms,
      occupiedRooms,
      occupancyRate:
        totalRooms > 0 ? parseFloat(((occupiedRooms / totalRooms) * 100).toFixed(2)) : 0,
      totalReservations,
      totalRevenue: totalRevenue[0]?.total || 0,
      pendingPayments: pendingPayments[0] || { total: 0, count: 0 },
      monthlyPayrollCost: monthlyPayroll[0]?.total || 0,
      maintenanceStatus: { open: openMaintenance, inProgress: inProgressMaintenance },
      revenueByMonth,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('superAdminDashboard error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard data', error: error.message });
  }
};

// ─── ADMIN Dashboard ──────────────────────────────────────────────────────────
const adminDashboard = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const [
      todayCheckIns,
      todayCheckOuts,
      occupiedRooms,
      totalRooms,
      availableRooms,
      maintenanceRooms,
      blockedRooms,
      pendingReservations,
      openMaintenance,
      upcomingReservations,
    ] = await Promise.all([
      Reservation.find({
        checkInDate: { $gte: today, $lt: tomorrow },
        status: { $ne: RESERVATION_STATUS.CANCELLED },
      }).populate('customerId', 'firstName lastName email phone'),

      Reservation.find({
        checkOutDate: { $gte: today, $lt: tomorrow },
        status: { $ne: RESERVATION_STATUS.CANCELLED },
      }).populate('customerId', 'firstName lastName email phone'),

      Room.countDocuments({ status: 'OCCUPIED' }),
      Room.countDocuments({ isActive: true }),
      Room.countDocuments({ status: 'AVAILABLE' }),
      Room.countDocuments({ status: 'MAINTENANCE' }),
      Room.countDocuments({ status: 'BLOCKED' }),
      Reservation.countDocuments({ status: RESERVATION_STATUS.PENDING }),

      Maintenance.find({ status: MAINTENANCE_STATUS.OPEN })
        .populate('roomId', 'roomNumber')
        .sort({ priority: -1 }),

      Reservation.find({
        checkInDate: { $lt: nextWeek },
        status: { $in: [RESERVATION_STATUS.PENDING, RESERVATION_STATUS.CONFIRMED] },
      })
        .populate('customerId', 'firstName lastName email')
        .populate('roomId', 'roomNumber')
        .limit(10),
    ]);

    res.json({
      todayCheckIns: todayCheckIns.length,
      todayCheckInsDetails: todayCheckIns,
      todayCheckOuts: todayCheckOuts.length,
      todayCheckOutsDetails: todayCheckOuts,
      roomStatus: {
        occupied: occupiedRooms,
        available: availableRooms,
        maintenance: maintenanceRooms,
        blocked: blockedRooms,
        total: totalRooms,
      },
      occupancyRate:
        totalRooms > 0 ? parseFloat(((occupiedRooms / totalRooms) * 100).toFixed(2)) : 0,
      pendingReservations,
      openMaintenance,
      upcomingReservations,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('adminDashboard error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard data', error: error.message });
  }
};

// ─── ACCOUNTANT Dashboard ─────────────────────────────────────────────────────
const accountantDashboard = async (req, res) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [paymentSummary, todayRevenue, monthlyRevenue, payrollSummary, pendingPayments] =
      await Promise.all([
        // Summary grouped by status
        Payment.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
        ]),

        // Today's revenue — guard paidAt null to prevent $dateToString crash
        Payment.aggregate([
          {
            $match: {
              status: PAYMENT_STATUS.PAID,
              paidAt: { $ne: null, $exists: true, $gte: today, $lt: tomorrow },
            },
          },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),

        // Monthly revenue last 6 months — guard paidAt null
        Payment.aggregate([
          {
            $match: {
              status: PAYMENT_STATUS.PAID,
              paidAt: { $ne: null, $exists: true },
            },
          },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m', date: '$paidAt' } },
              revenue: { $sum: '$amount' },
            },
          },
          { $sort: { _id: -1 } },
          { $limit: 6 },
        ]),

        // Payroll summary for current month
        Payroll.aggregate([
          { $match: { month: currentMonth } },
          {
            $group: {
              _id: null,
              totalBaseSalary: { $sum: '$baseSalary' },
              totalBonus: { $sum: '$bonus' },
              totalDeductions: { $sum: '$deductions' },
              totalNetSalary: { $sum: '$netSalary' },
              paidCount: { $sum: { $cond: ['$isPaid', 1, 0] } },
              pendingCount: { $sum: { $cond: ['$isPaid', 0, 1] } },
            },
          },
        ]),

        // FIX: Payment schema has no customerId or reservationId fields.
        // Customer info is stored inline (customerName, customerEmail, customerPhone).
        // The reservation ref field is named `reservation`, not `reservationId`.
        Payment.find({ status: PAYMENT_STATUS.PENDING })
          .populate('reservation', 'reservationNumber checkInDate checkOutDate')
          .sort({ createdAt: -1 })
          .limit(10),
      ]);

    res.json({
      paymentSummary,
      todayRevenue: todayRevenue[0]?.total || 0,
      monthlyRevenue,
      currentMonth,
      payrollSummary: payrollSummary[0] || {
        totalBaseSalary: 0,
        totalBonus: 0,
        totalDeductions: 0,
        totalNetSalary: 0,
        paidCount: 0,
        pendingCount: 0,
      },
      pendingPayments,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('accountantDashboard error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard data', error: error.message });
  }
};

// ─── STAFF Dashboard ──────────────────────────────────────────────────────────
const staffDashboard = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [todayCheckIns, todayCheckOuts, roomStatus, assignedMaintenance, openMaintenance] =
      await Promise.all([
        Reservation.find({
          checkInDate: { $gte: today, $lt: tomorrow },
          status: { $ne: RESERVATION_STATUS.CANCELLED },
        })
          .populate('customerId', 'firstName lastName email phone')
          .populate('roomId', 'roomNumber type'),

        Reservation.find({
          checkOutDate: { $gte: today, $lt: tomorrow },
          status: { $ne: RESERVATION_STATUS.CANCELLED },
        })
          .populate('customerId', 'firstName lastName email phone')
          .populate('roomId', 'roomNumber type'),

        Room.aggregate([
          { $match: { isActive: true } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),

        Maintenance.find({
          assignedTo: req.user._id,
          status: { $ne: MAINTENANCE_STATUS.COMPLETED },
        })
          .populate('roomId', 'roomNumber type')
          .sort({ priority: -1 }),

        Maintenance.countDocuments({ status: MAINTENANCE_STATUS.OPEN }),
      ]);

    res.json({
      todayCheckIns: todayCheckIns.length,
      todayCheckInsDetails: todayCheckIns,
      todayCheckOuts: todayCheckOuts.length,
      todayCheckOutsDetails: todayCheckOuts,
      roomStatus,
      assignedMaintenanceTasks: assignedMaintenance.length,
      assignedMaintenanceDetails: assignedMaintenance,
      totalOpenMaintenance: openMaintenance,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('staffDashboard error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard data', error: error.message });
  }
};

// ─── CUSTOMER Dashboard ───────────────────────────────────────────────────────
const customerDashboard = async (req, res) => {
  try {
    const customerId = req.user._id;

    const [reservations, payments, upcomingReservations] = await Promise.all([
      Reservation.find({ customerId })
        .populate('roomId', 'roomNumber type pricePerNight')
        .populate('hallId', 'hallName pricePerHour')
        .sort({ createdAt: -1 }),

      // FIX: Payment has no customerId field — match via reservation instead.
      // First get the customer's reservation IDs, then find payments for them.
      Reservation.find({ customerId }).select('_id').then((reservations) => {
        const reservationIds = reservations.map((r) => r._id);
        return Payment.find({ reservation: { $in: reservationIds } })
          .populate('reservation', 'reservationNumber checkInDate checkOutDate')
          .sort({ createdAt: -1 });
      }),

      Reservation.find({
        customerId,
        checkInDate: { $gte: new Date() },
        status: { $ne: RESERVATION_STATUS.CANCELLED },
      })
        .populate('roomId', 'roomNumber type')
        .sort({ checkInDate: 1 }),
    ]);

    // Payment summary via reservation join
    const reservationIds = reservations.map((r) => r._id);
    const paymentSummary = await Payment.aggregate([
      { $match: { reservation: { $in: reservationIds } } },
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]);

    res.json({
      totalReservations: reservations.length,
      totalPayments: payments.length,
      paymentSummary,
      recentReservations: reservations.slice(0, 5),
      upcomingReservations,
      recentPayments: payments.slice(0, 5),
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('customerDashboard error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard data', error: error.message });
  }
};

// ─── Role dispatcher ──────────────────────────────────────────────────────────
const getDashboard = async (req, res) => {
  const role = req.user?.role;
  if (role === ROLES.SUPER_ADMIN) return superAdminDashboard(req, res);
  if (role === ROLES.ADMIN)       return adminDashboard(req, res);
  if (role === ROLES.MANAGER)     return superAdminDashboard(req, res);
  if (role === ROLES.HR)          return staffDashboard(req, res);
  if (role === ROLES.ACCOUNTANT)  return accountantDashboard(req, res);
  if (role === ROLES.STAFF)       return staffDashboard(req, res);
  if (role === ROLES.CUSTOMER)    return customerDashboard(req, res);
  return res.status(403).json({ message: 'Unauthorized role' });
};

// ─── Advanced Analytics ───────────────────────────────────────────────────────
const getAdvancedAnalytics = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();

    const [dailyRevenue, dailyReservations] = await Promise.all([
      Payment.aggregate([
        {
          $match: {
            status: PAYMENT_STATUS.PAID,
            paidAt: { $ne: null, $exists: true, $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } },
            revenue: { $sum: '$amount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      Reservation.aggregate([
        {
          $match: {
            checkInDate: { $gte: start, $lte: end },
            status: { $ne: RESERVATION_STATUS.CANCELLED },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$checkInDate' } },
            count: { $sum: 1 },
            guests: { $sum: '$numberOfGuests' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.json({
      timeRange: { start, end },
      dailyRevenue,
      dailyReservations,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('getAdvancedAnalytics error:', error);
    res.status(500).json({ message: 'Failed to fetch advanced analytics', error: error.message });
  }
};

module.exports = {
  getDashboard,
  getAdvancedAnalytics,
  superAdminDashboard,
  adminDashboard,
  accountantDashboard,
  staffDashboard,
  customerDashboard,
};