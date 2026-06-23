const Payment = require('../../models/Payment');
const Reservation = require('../../models/Reservation');
const chapa = require('../../config/chapa');
const { PAYMENT_STATUS, ROLES } = require('../../config/constants');
const { sendEmail, emailTemplates } = require('../../services/emailService');
const { createNotification } = require('../../services/notificationService');
const { createPaymentIntent, finalizePaymentIntent } = require('../../services/paymentService');



// Initialize Chapa payment
exports.initiateChapaPayment = async (req, res) => {
  try {
    const { reservationId, amount, customerEmail, customerPhone, customerName } = req.body;

    const reservation = await Reservation.findById(reservationId).populate('customerId');
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    // Only allow the owner or admin+ to initiate payment
    const { role, _id: userId } = req.user;
    if (role === ROLES.CUSTOMER && reservation.customerId._id.toString() !== userId.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if a PAID payment already exists — prevent duplicate payments
    const paidPayment = await Payment.findOne({
      reservation: reservationId,
      status: PAYMENT_STATUS.PAID
    });
    if (paidPayment) {
      return res.status(400).json({ 
        message: 'This reservation has already been paid',
        payment: paidPayment
      });
    }

    // Check if an active PENDING or PROCESSING payment already exists for this reservation
    let payment = await Payment.findOne({
      reservation: reservationId,
      status: { $in: [PAYMENT_STATUS.PENDING, 'PROCESSING'] }
    });

    if (payment) {
      // Reuse existing pending payment document
      payment.amount = amount;
      payment.customerEmail = customerEmail || reservation.customerId?.email;
      payment.customerPhone = customerPhone || reservation.customerId?.phone;
      payment.customerName = customerName || `${reservation.customerId?.firstName || ''} ${reservation.customerId?.lastName || ''}`.trim();
    } else {
      // Create a brand new one only if none exist
      payment = new Payment({
        reservation: reservationId,
        amount,
        currency: 'ETB',
        paymentMethod: 'CHAPA',
        status: PAYMENT_STATUS.PENDING,
        customerEmail: customerEmail || reservation.customerId?.email,
        customerPhone: customerPhone || reservation.customerId?.phone,
        customerName: customerName || `${reservation.customerId?.firstName || ''} ${reservation.customerId?.lastName || ''}`.trim(),
        paymentDescription: `Payment for reservation ${reservation.reservationNumber}`,
      });
    }

    await payment.save();

    const txRef = payment._id.toString();

    const chapaResponse = await chapa.initialize({
      amount,
      currency: 'ETB',
      email: payment.customerEmail,
      first_name: payment.customerName.split(' ')[0],
      last_name: payment.customerName.split(' ').slice(1).join(' ') || '',
      phone_number: payment.customerPhone ? payment.customerPhone.replace(/[^0-9]/g, '') : undefined,
      tx_ref: txRef,
      callback_url: `${process.env.SERVER_URL || 'http://localhost:8000'}/api/payments/chapa/webhook`,
      return_url: `${process.env.CLIENT_URL}/payment-callback?tx_ref=${txRef}`,
      customization: {
        title: 'Hotel Booking Payment',
        description: payment.paymentDescription,
      },
    });

    if (chapaResponse.status === 'success') {
      payment.chapaReference = chapaResponse.tx_ref || txRef;
      payment.chapaCheckoutUrl = chapaResponse.data?.checkout_url;
      await payment.save();

      return res.status(201).json({
        message: 'Payment initiated successfully',
        payment,
        checkout_url: chapaResponse.data?.checkout_url,
      });
    } else {
      payment.status = PAYMENT_STATUS.FAILED;
      await payment.save();
      return res.status(400).json({
        message: 'Failed to initiate payment',
        error: chapaResponse.message,
      });
    }
  } catch (error) {
    console.error('Payment initiation error:', error);
    res.status(500).json({ message: 'Error initiating payment', error: error.message });
  }
};

// Verify Chapa payment
exports.verifyChapaPayment = async (req, res) => {
  try {
    const { txRef } = req.body;

    if (!txRef) {
      return res.status(400).json({ message: 'Transaction reference is required' });
    }

    const verificationResponse = await chapa.verify(txRef);

    if (verificationResponse.status === 'success') {
      const paymentStatus = verificationResponse.data.status;

      const payment = await Payment.findOne({ chapaReference: txRef });
      if (payment) {
        if (paymentStatus === 'success') {
          payment.status = PAYMENT_STATUS.PAID;
          payment.paidAt = new Date();
          payment.chapaTransactionId = verificationResponse.data.charge;

          createNotification(req.io, {
            title: 'Payment Successful',
            message: `Payment of ETB ${payment.amount?.toLocaleString()} was confirmed via Chapa.`,
            type: 'PAYMENT_PAID',
            targetRoles: ['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT'],
            resourceId: payment._id,
            resourceType: 'Payment',
          });

          await Payment.updateMany(
            {
              reservation: payment.reservation,
              _id: { $ne: payment._id },
              status: PAYMENT_STATUS.PENDING,
            },
            {
              $set: {
                status: PAYMENT_STATUS.FAILED,
                failureReason: 'Superseded by successful transaction',
              },
            }
          );
        } else if (paymentStatus === 'failed') {
          payment.status = PAYMENT_STATUS.FAILED;
          payment.failureReason = verificationResponse.data.reason;
        } else {
          payment.status = PAYMENT_STATUS.PENDING;
        }
        await payment.save();

        if (paymentStatus === 'success') {
          await Reservation.findByIdAndUpdate(payment.reservation, {
            paymentStatus: 'PAID',
          });
        }
      }

      return res.json({
        message: 'Payment verified',
        status: paymentStatus,
        payment,
      });
    }

    return res.status(400).json({
      message: 'Payment verification failed',
      error: verificationResponse.message,
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ message: 'Error verifying payment', error: error.message });
  }
};

exports.createPaymentIntent = async (req, res) => {
  try {
    const { reservationId, amount, customerEmail, customerPhone, customerName } = req.body;
    const payload = { reservationId, amount, customerEmail, customerPhone, customerName, req };
    const { paymentIntent, checkoutUrl } = await createPaymentIntent(payload);

    return res.status(201).json({
      message: 'Payment intent created',
      paymentIntent,
      checkoutUrl,
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ message: 'Error creating payment intent', error: error.message });
  }
};

exports.finalizePaymentIntent = async (req, res) => {
  try {
    const { txRef } = req.body;
    const payload = { txRef, req };
    const result = await finalizePaymentIntent(payload);

    return res.json({
      message: 'Payment finalized',
      result,
    });
  } catch (error) {
    console.error('Finalize payment intent error:', error);
    res.status(500).json({ message: 'Error finalizing payment intent', error: error.message });
  }
};

// Get all payments - ROLE FILTERED
exports.getAllPayments = async (req, res) => {
  try {
    const { role, _id: userId } = req.user;

    let payments;

    if (role === ROLES.CUSTOMER) {
      // Customer: find their reservation IDs first, then filter payments
      const myReservations = await Reservation.find({ customerId: userId }).select('_id');
      const reservationIds = myReservations.map(r => r._id);
      payments = await Payment.find({ reservation: { $in: reservationIds } })
        .populate('reservation', 'reservationNumber checkInDate checkOutDate')
        .sort({ createdAt: -1 });
    } else {
      // ADMIN, SUPER_ADMIN, ACCOUNTANT: see all
      payments = await Payment.find()
        .populate('reservation', 'reservationNumber checkInDate checkOutDate')
        .sort({ createdAt: -1 });
    }

    res.json({
      message: 'Payments retrieved successfully',
      payments,
      total: payments.length,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payments', error: error.message });
  }
};

// Get payment by ID - with ownership check
exports.getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, _id: userId } = req.user;

    const payment = await Payment.findById(id).populate('reservation');

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    // Customer: can only see their own payments
    if (role === ROLES.CUSTOMER) {
      const reservation = await Reservation.findById(payment.reservation?._id || payment.reservation);
      if (!reservation || reservation.customerId.toString() !== userId.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    res.json({ message: 'Payment retrieved successfully', payment });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching payment', error: error.message });
  }
};

// Mark payment as paid (manual)
exports.markPaymentAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod } = req.body;

    const payment = await Payment.findByIdAndUpdate(
      id,
      {
        status: PAYMENT_STATUS.PAID, // FIX: was COMPLETED
        paidAt: new Date(),
        paymentMethod: paymentMethod || 'CASH',
      },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    await Reservation.findByIdAndUpdate(payment.reservation, { paymentStatus: 'PAID' });

    createNotification(req.io, {
      title: 'Payment Processed',
      message: `Payment of ETB ${payment.amount?.toLocaleString()} marked as paid.`,
      type: 'PAYMENT_PAID',
      senderId: req.user._id,
      targetRoles: ['SUPER_ADMIN', 'ACCOUNTANT'],
      resourceId: payment._id,
      resourceType: 'Payment',
    });

    try {
      const reservation = await Reservation.findById(payment.reservation).populate('customerId');
      if (payment.customerEmail) {
        await sendEmail(payment.customerEmail, emailTemplates.paymentConfirmation, { payment, reservation });
      }
    } catch (emailError) {
      console.error('Email send error:', emailError);
    }

    res.json({ message: 'Payment marked as paid', payment });
  } catch (error) {
    res.status(500).json({ message: 'Error updating payment', error: error.message });
  }
};

// Mark payment as failed
exports.markPaymentAsFailed = async (req, res) => {
  try {
    const { id } = req.params;
    const { failureReason } = req.body;

    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    payment.status = PAYMENT_STATUS.FAILED;
    payment.failureReason = failureReason || 'Payment declined';
    payment.retryCount = (payment.retryCount || 0) + 1;
    payment.lastRetryAt = new Date();

    await payment.save();

    res.json({ message: 'Payment marked as failed', payment });
  } catch (error) {
    res.status(500).json({ message: 'Error updating payment', error: error.message });
  }
};

// Get payment statistics
exports.getPaymentStats = async (req, res) => {
  try {
    // Group by status — all payments
    const stats = await Payment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    // Total revenue — PAID only (was COMPLETED which doesn't exist, so always returned 0)
    const totalRevenue = await Payment.aggregate([
      { $match: { status: PAYMENT_STATUS.PAID } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    // Revenue breakdown by payment method (CASH, CHAPA, etc.)
    const revenueByMethod = await Payment.aggregate([
      { $match: { status: PAYMENT_STATUS.PAID } },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          total: { $sum: '$amount' },
        },
      },
    ]);

    res.json({
      message: 'Payment statistics retrieved',
      stats,
      totalRevenue: totalRevenue[0]?.total || 0,
      revenueByMethod,
      statusBreakdown: stats,
      pendingPayments: {
        count: stats.find((s) => s._id === 'PENDING')?.count || 0,
        total: stats.find((s) => s._id === 'PENDING')?.totalAmount || 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: 'Error fetching payment stats',
      error: error.message,
    });
  }
};