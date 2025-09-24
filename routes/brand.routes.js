const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brand.controller');
const reportController = require('../controllers/report.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const deliverableController = require('../controllers/deliverable.controller');
const upload = require('../middleware/upload');

// Brand dashboard - see all requests & campaigns
router.get('/dashboard/requests', verifyToken, requireRole('brand'), brandController.getMyRequests);
router.get('/overview', verifyToken, requireRole('brand'), brandController.getBrandOverview);
router.get('/influencers',verifyToken, requireRole('brand'), brandController.influencers);
router.get('/campaigns', verifyToken, requireRole('brand'), brandController.campaign);
router.get('/rating',verifyToken, requireRole('brand'),brandController.ratings);
router.post('/addRating', verifyToken, requireRole('brand'), brandController.addRating);
router.get("/profile", verifyToken, requireRole('brand'), brandController.profile);
router.put('/update', verifyToken, requireRole('brand'), brandController.updateBrandProfile);
router.patch('/upload-profile', verifyToken, requireRole('brand'), upload.single('image'), brandController.uploadProfileImage);
router.get('/me', verifyToken, requireRole('brand'), brandController.getMyProfile);
router.get('/list', brandController.brandList);
router.post('/add-campaign', verifyToken, requireRole('brand'), upload.single('feature_image'), brandController.createCampaign);

router.get('/campaigns-list',verifyToken, requireRole('brand'),brandController.getMyCampaigns);
  router.put('/campaigns/:id',verifyToken,requireRole('brand'),upload.single('feature_image'),brandController.updateCampaign);
  router.get("/campaigns/:id", verifyToken, requireRole("brand"), brandController.getCampaignById);

  
router.get('/approved-influencers', verifyToken, requireRole('brand'),brandController.getCampaignApplications);
router.get('/applications/forwarded', verifyToken, requireRole('brand'), brandController.getForwardedApplications);
router.post('/applications/:id/decision', verifyToken, requireRole('brand'), brandController.flagApplicationDecision);



// Deliverables listing for a campaign
router.get(
  '/campaigns/:id/deliverables',
  verifyToken, requireRole('brand'),
  deliverableController.getCampaignDeliverables
);

// Review a deliverable
router.post(
  '/deliverables/:deliverableId/review',
  verifyToken, requireRole(['brand','admin']),
  reportController.reviewDeliverable
);

// Campaign aggregated report (JSON)
router.get(
  '/campaigns/:id/report',
  verifyToken, requireRole(['brand','admin']),
  reportController.getCampaignReport
);

// Export campaign report as PDF
router.get(
  '/campaigns/:id/report/pdf',
  verifyToken, requireRole(['brand','admin']),
  reportController.exportCampaignReportPDF
);

// ✅ Fetch all influencers
router.get('/influencers',  brandController.getAllInfluencers);

// ✅ Fetch influencer by ID
router.get('/influencers/:id', verifyToken, requireRole('brand'), brandController.getInfluencerById);

// routes/brand.js
router.get(
  '/dashboard/insights',
  verifyToken,
  requireRole('brand'),
  brandController.getDashboardInsights
);


module.exports = router;