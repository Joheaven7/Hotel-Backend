const Payment = require('../models/Payment');
const PaymentIntent = require('../models/PaymentIntent');
const Reservation = require('../models/Reservation');
const { PAYMENT_INTENT_STATUS, PAYMENT_STATUS, RESERVATION_STATUS } = require('../config/constants');
const chapa = require('../config/chapa');
const { scheduleCheckInReminder, scheduleCheckout } = require('./queueService');
const { logAudit } = require('../middlewares/auditLogger');

const createPaymentIntent = async ({ reservationId, amount, customerEmail, customerPhone, customerName, req }) => {
  const reservation = await Reservation.findById(reservationId);
  if (!reservation) {
    throw new Error('Reservation not found');
  }

  if (reservation.status === RESERVATION_STATUS.CANCELLED) {
    throw new Error('Cannot create payment intent for cancelled reservation');
  }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  const existingIntent = await PaymentIntent.findOne({
    reservation: reservationId,
    status: { $in: [PAYMENT_INTENT_STATUS.INITIATED, PAYMENT_INTENT_STATUS.AUTHORIZED] },
  });

  const paymentIntent = existingIntent || new PaymentIntent({
    reservation: reservationId,
    amount,
    currency: 'ETB',
    customerEmail,
    customerPhone,
    customerName,
    expiresAt,
  });

  const txRef = paymentIntent._id.toString();
  const chapaResponse = await chapa.initialize({
    amount,
    currency: 'ETB',
    email: paymentIntent.customerEmail,
    first_name: paymentIntent.customerName.split(' ')[0],
    last_name: paymentIntent.customerName.split(' ').slice(1).join(' ') || '',
    phone_number: paymentIntent.customerPhone,
    tx_ref: txRef,
    callback_url: `${process.env.SERVER_URL || 'http://localhost:8000'}/api/payments/chapa/webhook`,
    return_url: `${process.env.CLIENT_URL}/payment-callback?tx_ref=${txRef}`,
    customization: {
      title: 'Hotel Booking Payment',
      description: `Payment for reservation ${reservation.reservationNumber}`,
    },
  });

  if (chapaResponse.status !== 'success') {
    paymentIntent.status = PAYMENT_INTENT_STATUS.FAILED;
    paymentIntent.failureReason = chapaResponse.message || 'Payment initialization failed';
    await paymentIntent.save();
    throw new Error(paymentIntent.failureReason);
  }

  paymentIntent.providerRef = chapaResponse.tx_ref || txRef;
  paymentIntent.status = PAYMENT_INTENT_STATUS.AUTHORIZED;
  paymentIntent.expiresAt = expiresAt;
  await paymentIntent.save();

  if (req) {
    logAudit({
      userId: req.user._id,
      user: req.user,
      actionType: 'PAYMENT_PROCESS',
      resource: req.originalUrl,
      targetId: paymentIntent._id,
      details: { reservationId, amount, status: paymentIntent.status },
      req,
    });
  }

  return { paymentIntent, checkoutUrl: chapaResponse.data?.checkout_url };
};

const finalizePaymentIntent = async ({ txRef, req }) => {
  const paymentIntent = await PaymentIntent.findOne({ providerRef: txRef });
  if (!paymentIntent) {
    throw new Error('Payment intent not found');
  }

  const verificationResponse = await chapa.verify(txRef);
  if (verificationResponse.status !== 'success') {
    paymentIntent.status = PAYMENT_INTENT_STATUS.FAILED;
    paymentIntent.failureReason = verificationResponse.message || 'Verification failed';
    await paymentIntent.save();
    return paymentIntent;
  }

  paymentIntent.status = PAYMENT_INTENT_STATUS.CAPTURED;
  paymentIntent.providerRef = txRef;
  await paymentIntent.save();

  const reservation = await Reservation.findById(paymentIntent.reservation);
  if (!reservation) {
    throw new Error('Reservation not found');
  }

  if (reservation.status !== RESERVATION_STATUS.CONFIRMED) {
    reservation.status = RESERVATION_STATUS.CONFIRMED;
    await reservation.save();
  }

  await Payment.updateMany(
    { reservation: reservation._id, status: PAYMENT_STATUS.PENDING },
    { status: PAYMENT_STATUS.FAILED, failureReason: 'Superseded by captured payment' }
  );

  const payment = new Payment({
    reservation: reservation._id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    status: PAYMENT_STATUS.PAID,
    paymentMethod: 'CHAPA',
    paymentIntent: paymentIntent._id,
    providerRef: paymentIntent.providerRef,
    paidAt: new Date(),
    paymentDescription: `Payment for reservation ${reservation.reservationNumber}`,
    customerEmail: paymentIntent.customerEmail,
    customerPhone: paymentIntent.customerPhone,
    customerName: paymentIntent.customerName,
  });

  await payment.save();

  await scheduleCheckInReminder(reservation._id, reservation.checkInDate);
  await scheduleCheckout(reservation._id, reservation.checkOutDate);

  if (req) {
    logAudit({
      userId: req.user._id,
      user: req.user,
      actionType: 'PAYMENT_PROCESS',
      resource: req.originalUrl,
      targetId: payment._id,
      details: {
        paymentIntentId: paymentIntent._id,
        reservationId: reservation._id,
        amount: payment.amount,
        status: payment.status,
      },
      beforeState: paymentIntent.toObject(),
      afterState: { ...paymentIntent.toObject(), status: PAYMENT_INTENT_STATUS.CAPTURED },
      req,
    });
  }

  return { payment, paymentIntent, reservation };
};

module.exports = {
  createPaymentIntent,
  finalizePaymentIntent,
};
