const express = require('express');
const router = express.Router();
const influencerController = require('../controllers/influencer.controller');
const deliverableController = require('../controllers/deliverable.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload');

// ✅ Get notifications (Only influencers)
router.get('/notifications', verifyToken, requireRole('influencer'), influencerController.getNotifications);

// ✅ Mark a notification as read
router.put('/notifications/:id', verifyToken, requireRole('influencer'), influencerController.markNotificationAsRead);

router.get('/campaigns', verifyToken, requireRole('influencer'), influencerController.getMyCampaigns);

router.get('/last-collab', verifyToken, requireRole('influencer'), influencerController.getLastCollab);

router.get('/overview',verifyToken, requireRole('influencer'), influencerController.overview);

router.get('/me', verifyToken, requireRole('influencer'), influencerController.getMyProfile);
router.put('/update', verifyToken, requireRole('influencer'), influencerController.updateMyProfile);

router.patch('/upload-profile', verifyToken, requireRole('influencer'), upload.single('image'), influencerController.uploadProfileImage);

router.get('/influencer-filter', influencerController.influencer);

router.get('/campaigns/feed', verifyToken, requireRole('influencer'), influencerController.getCampaignFeed);
router.get('/campaigns/:id', verifyToken, requireRole('influencer'), influencerController.getSingleCampaign);
router.post('/campaigns/:id/apply', verifyToken, requireRole('influencer'), influencerController.applyToCampaign);
router.get('/applied-campaigns', verifyToken, requireRole('influencer'), influencerController.getAppliedCampaigns);

// routes/influencer.js
router.post(
    '/campaigns/:id/deliverables',
    verifyToken, requireRole('influencer'),
    upload.single('proof_file'), // Multer
    deliverableController.submitDeliverable
  );
  
  router.put(
    '/deliverables/:deliverableId',
    verifyToken, requireRole('influencer'),
    upload.single('proof_file'),
    deliverableController.updateOwnDeliverable
  );
  


module.exports = router;
