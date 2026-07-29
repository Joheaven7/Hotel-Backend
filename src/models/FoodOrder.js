const mongoose = require('mongoose');
const { FOOD_ORDER_STATUS, PAYMENT_STATUS } = require('../config/constants');

const orderItemSchema = new mongoose.Schema({
  foodItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FoodItem',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  price: {
    type: Number,
    required: true,
  },
  specialInstructions: {
    type: String,
    default: '',
  },
});

const foodOrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      default: () => `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
    },
    reservation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reservation',
      default: null,
    },
    customerName: {
      type: String,
      default: 'Guest',
    },
    customerPhone: {
      type: String,
      default: '',
    },
    items: [orderItemSchema],
    subtotal: {
      type: Number,
      required: true,
    },
    tax: {
      type: Number,
      default: 0,
    },
    serviceCharge: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.UNPAID,
    },
    paymentMethod: {
      type: String,
      enum: ['CHAPA', 'CASH', 'ROOM_CHARGE'],
      default: 'CHAPA',
    },
    paymentReference: {
      type: String, // E.g., Chapa tx_ref
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(FOOD_ORDER_STATUS),
      default: FOOD_ORDER_STATUS.PENDING_PAYMENT,
    },
    specialInstructions: {
      type: String,
      default: '',
    },
    estimatedTime: {
      type: Number, // in minutes
      default: 30,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // Null if ordered via QR code
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FoodOrder', foodOrderSchema);
