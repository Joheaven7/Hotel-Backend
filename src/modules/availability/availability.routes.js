const express = require('express');
const router = express.Router();
const availabilityController = require('./availability.controller');

router.post('/check', availabilityController.checkAvailability);

module.exports = router;
