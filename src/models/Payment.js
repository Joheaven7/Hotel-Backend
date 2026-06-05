const mongoose = require('mongoose');
const { PAYMENT_STATUS } = require('../config/constants');

const paymentSchema = new mongoose.Schema(
  {
    paymentNumber: {
      type: String,
      unique: true,
      default: () => `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    },
    reservation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reservation',
      required: true,
    },
    paymentIntent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentIntent',
      default: null,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'ETB',
      enum: ['ETB', 'USD'],
    },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    paymentMethod: {
      type: String,
      enum: ['CHAPA', 'CASH', 'BANK_TRANSFER', 'CARD'],
      default: 'CHAPA',
    },
    // Chapa specific fields
    chapaReference: {
      type: String,
      unique: true,
      sparse: true,
    },
    chapaTransactionId: String,
    chapaCheckoutUrl: String,
    
    // Payment details
    paidAt: Date,
    paymentDescription: String,
    
    // Customer info
    customerEmail: {
      type: String,
      required: true,
    },
    customerPhone: String,
    customerName: String,
    
    // Retry info
    retryCount: {
      type: Number,
      default: 0,
    },
    lastRetryAt: Date,
    failureReason: String,
  },
  { timestamps: true }
);

// Index for faster queries
paymentSchema.index({ reservation: 1, status: 1 });
paymentSchema.index({ chapaReference: 1 });
paymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);