// routes/instrackRoute.js

const express = require('express');
const router = express.Router();
const { getInstrackData } = require('../controllers/instagram.controller');

// GET /instrack/:username
router.get('/:username', getInstrackData);

module.exports = router;
