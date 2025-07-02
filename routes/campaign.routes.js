const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaign.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');


router.post('/rate', verifyToken, requireRole('brand'), campaignController.rateInfluencer);
router.post('/rate/admin', verifyToken, requireRole('admin'), campaignController.rateInfluencer);

module.exports = router;
