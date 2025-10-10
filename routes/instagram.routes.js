// routes/instrackRoute.js

const express = require('express');
const router = express.Router();
const { getInstrackData } = require('../controllers/instagram.controller');
const { fetchPostsController } = require("../controllers/fetchpostviaThirdpart");


// GET /instrack/:username
router.get('/:username', getInstrackData);
router.post("/posts", fetchPostsController);


module.exports = router;
