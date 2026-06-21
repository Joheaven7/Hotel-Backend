const express = require('express');
const router = express.Router();
const typesController = require('./types.controller');

router.get('/', typesController.getAllTypes);

module.exports = router;
