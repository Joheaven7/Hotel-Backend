const mongoose = require('mongoose');
const { PAYMENT_INTENT_STATUS } = require('../config/constants');

const paymentIntentSchema = new mongoose.Schema(
  {
    reservation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reservation',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: ['ETB', 'USD'],
      default: 'ETB',
    },
    status: {
      type: String,
      enum: Object.values(PAYMENT_INTENT_STATUS),
      default: PAYMENT_INTENT_STATUS.INITIATED,
    },
    providerName: {
      type: String,
      default: 'CHAPA',
    },
    providerRef: {
      type: String,
      index: true,
      sparse: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    customerEmail: String,
    customerPhone: String,
    customerName: String,
    metadata: mongoose.Schema.Types.Mixed,
    failureReason: String,
  },
  { timestamps: true }
);

paymentIntentSchema.index({ reservation: 1, status: 1 });
paymentIntentSchema.index({ providerRef: 1 });
paymentIntentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PaymentIntent', paymentIntentSchema);
