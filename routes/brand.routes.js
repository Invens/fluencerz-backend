// routes/brand.js
const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brand.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload'); // Shared upload for general use
const drive = require('../controllers/drive.controller');
const reporting = require('../controllers/reporting.controller');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Ensure brands upload directory exists
const BRANDS_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'brands');
if (!fs.existsSync(BRANDS_UPLOAD_DIR)) {
  fs.mkdirSync(BRANDS_UPLOAD_DIR, { recursive: true });
  console.log('📁 Created brands upload directory:', BRANDS_UPLOAD_DIR);
}

// Brand-specific multer configuration (hardcoded to brands folder)
const brandStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, BRANDS_UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}-${file.fieldname}${ext}`;
    cb(null, uniqueName);
  }
});

// Reuse the fileFilter from shared upload (assuming it's exported; if not, copy it here)
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
    return cb(new Error('Only JPG, JPEG, PNG files allowed'), false);
  }
  cb(null, true);
};

const brandUpload = multer({ storage: brandStorage, fileFilter });

// Brand dashboard - see all requests & campaigns
router.get('/dashboard/requests', verifyToken, requireRole('brand'), brandController.getMyRequests);
router.get('/overview', verifyToken, requireRole('brand'), brandController.getBrandOverview);
router.get('/influencers',verifyToken, requireRole('brand'), brandController.influencers);
router.get('/influencers/meta', verifyToken, requireRole('brand'), brandController.influencerFilterMeta);
router.get('/campaigns', verifyToken, requireRole('brand'), brandController.campaign);
router.get('/rating',verifyToken, requireRole('brand'),brandController.ratings);
router.post('/addRating', verifyToken, requireRole('brand'), brandController.addRating);
router.get("/profile", verifyToken, requireRole('brand'), brandController.profile);
router.put('/update', verifyToken, requireRole('brand'), brandController.updateBrandProfile);
router.patch('/upload-profile', verifyToken, requireRole('brand'), brandUpload.single('image'), brandController.uploadProfileImage);

router.post('/add-to-campaign/:id', verifyToken, requireRole('brand'), brandController.addInfluencersToCampaign);

router.get('/me', verifyToken, requireRole('brand'), brandController.getMyProfile);
router.get('/list', brandController.brandList);
router.post('/add-campaign', verifyToken, requireRole('brand'), brandUpload.single('feature_image'), brandController.createCampaign);

router.get('/campaigns-list',verifyToken, requireRole('brand'),brandController.getMyCampaigns);
router.put('/campaigns/:id',verifyToken,requireRole('brand'),brandUpload.single('feature_image'),brandController.updateCampaign);
router.get("/campaigns/:id", verifyToken, requireRole("brand"), brandController.getCampaignById);

// New routes for campaign draft, unpublish, and delete
router.patch('/campaigns/:id/draft', verifyToken, requireRole('brand'), brandController.setCampaignToDraft);
router.patch('/campaigns/:id/unpublish', verifyToken, requireRole('brand'), brandController.unpublishCampaign);
router.patch('/campaigns/:id/publish', verifyToken, requireRole('brand'), brandController.publishCampaign);
router.delete('/campaigns/:id', verifyToken, requireRole('brand'), brandController.deleteCampaign);
router.get('/applications', verifyToken, requireRole('brand'), brandController.getAllApplications);
router.get('/approved-influencers', verifyToken, requireRole('brand'),brandController.getCampaignApplications);
router.get('/applications/forwarded', verifyToken, requireRole('brand'), brandController.getForwardedApplications);
router.post('/applications/:id/decision', verifyToken, requireRole('brand'), brandController.flagApplicationDecision);

// ✅ NEW: list approved influencers for a campaign (left pane)
router.get(
  '/campaigns/:id/drive/influencers',
  verifyToken, requireRole('brand'),
  drive.listCampaignInfluencers
);

// Enhanced drive list (threads, brand must pass influencer_id in query, influencer sees own)
router.get(
  '/campaigns/:id/drive',
  verifyToken, requireRole('brand'),
  drive.listAssets
);

// New: Full thread view
router.get(
  '/drive/thread/:bundleId',
  verifyToken, requireRole('brand'),
  drive.getThread
);

// Enhanced review batch (with thread spawn opt)
router.post(
  '/drive/review',
  verifyToken, requireRole('brand'),
  drive.reviewAssets
);

// create a request (now requires influencer_id)
router.post(
  '/campaigns/:id/drive/request',
  verifyToken, requireRole('brand'),
  drive.requestAsset
);

// versions for brand
router.get(
  '/drive/:fileId/versions',
  verifyToken, requireRole('brand'),
  drive.getVersionChain
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

router.post(
  "/recommend-influencers",
  verifyToken,
  requireRole("brand"),
  brandController.recommendInfluencers
);

// Create / get a report thread for a specific influencer on a campaign
router.post(
  '/campaigns/:id/reports/request',
  verifyToken, requireRole('brand'),
  reporting.brandRequestReport
);

// List all report threads for a campaign (brand view)
router.get(
  '/campaigns/:id/reports',
  verifyToken, requireRole('brand'),
  reporting.brandListThreads
);

// Review (approve/reject/needs_changes) one or many entries
router.post(
  '/reports/review',
  verifyToken, requireRole('brand'),
  reporting.reviewEntries
);

// Versions for an entry (brand allowed via campaign ownership)
router.get(
  '/reports/entries/:entryId/versions',
  verifyToken, requireRole('brand'),
  reporting.getVersionChain
);

// Add a comment to a thread
router.post(
  '/reports/threads/:threadId/comments',
  verifyToken, requireRole(['brand','admin']),
  reporting.addComment
);

router.post('/reports/entries/:entryId/request', verifyToken, requireRole('brand'), reporting.brandRequestChangesOverEntry);

module.exports = router;