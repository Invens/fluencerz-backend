const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');


router.post('/campaign/create', verifyToken, requireRole('super_admin'), adminController.createCampaign);

router.get('/campaigns', verifyToken, requireRole('super_admin'), adminController.getAllCampaigns);

router.get('/dashboard/stats', verifyToken, requireRole('super_admin'), adminController.getAdminStats);

router.get('/collab/requests', verifyToken, requireRole('super_admin'), adminController.getAllCollabRequests);

router.get('/brands/insights', verifyToken, requireRole('super_admin'), adminController.getBrandInsights);
router.get('/influencers/insights', verifyToken, requireRole('super_admin'), adminController.getInfluencerInsights);

module.exports = router;
