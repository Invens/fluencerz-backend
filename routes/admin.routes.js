const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const multer = require('multer');

// If you already have a global upload middleware, reuse it.
// Minimal multer for feature image
const upload = multer({ dest: 'uploads/brand' });

// 🔒 Secure all admin routes
router.use(verifyToken, requireRole('super_admin'));

/**
 * Campaigns
 */
router.post('/campaigns', upload.single('feature_image'), adminController.createCampaign);
router.get('/campaigns', adminController.getAllCampaigns);
router.get('/campaigns/:id', adminController.getCampaignDetails);

/**
 * Collab Requests
 */
router.get('/collab-requests', adminController.getAllCollabRequests);

/**
 * Brands
 */
router.get('/brands', adminController.getAllBrands);
router.get("/brands/:id", adminController.getBrandById); // ✅ new endpoint
router.get('/brands/:id/campaigns', adminController.getBrandCampaigns);

/**
 * Influencers
 */
router.get('/influencers', adminController.getAllInfluencers);
router.get('/influencers/:id', adminController.getInfluencerProfile);
router.post( "/influencers/:id/refresh-instagram", verifyToken,requireRole("super_admin"), adminController.refreshInstagramData);


/**
 * Insights & Stats
 */
router.get('/insights/brands', adminController.getBrandInsights);
router.get('/insights/influencers', adminController.getInfluencerInsights);
router.get('/stats', adminController.getAdminStats);

/**
 * Applications
 */
router.get('/applications/pending', adminController.getPendingApplications);
router.post('/application/:id/decision', adminController.handleApplication); 
router.get('/applications/forwarded', adminController.getForwardedApplications);
router.get('/applications/approved', adminController.getApprovedApplications);
router.get('/applications/rejected', adminController.getRejectedApplications);

/**
 * Moderation: Media & Messages
 */
router.get('/media/pending', adminController.getPendingMediaFiles);
router.put('/media/:id/approve', adminController.approveMediaFile);
router.get('/messages/pending', adminController.getPendingMessages);
router.put('/messages/:id/approve', adminController.approveMessage);

module.exports = router;
