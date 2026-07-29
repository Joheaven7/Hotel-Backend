const express = require('express');
const router = express.Router();

const menuController = require('./menu.controller');

// ==========================================
// PUBLIC MENU API (GUEST)
// ==========================================
// No auth middleware required for these routes

router.get('/', menuController.getMenu);
router.get('/room/validate', menuController.validateRoomByToken);
router.get('/room/:roomToken', menuController.validateRoom);
router.post('/order', menuController.createOrder);
router.post('/payment/chapa', menuController.initiateChapaPayment);
router.post('/payment/verify', menuController.verifyChapaPayment);
router.get('/order/:orderNumber', menuController.trackOrder);

// QR Menu Service Requests & Complaints (Unauthenticated Token-based)
router.post('/complaint', menuController.createGuestComplaint);
router.get('/complaint/:ticketNumber', menuController.getGuestComplaint);
router.post('/complaint/:ticketNumber/chat', menuController.addGuestComplaintChat);
router.post('/complaint/:ticketNumber/rate', menuController.rateGuestComplaint);

module.exports = router;
