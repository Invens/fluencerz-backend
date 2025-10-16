// routes/brand.js
const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brand.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload'); // if you still reuse elsewhere
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

// Brand-specific multer
const brandStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, BRANDS_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${file.fieldname}${ext}`);
  }
});
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!['.jpg', '.jpeg', '.png'].includes(ext)) return cb(new Error('Only JPG, JPEG, PNG files allowed'), false);
  cb(null, true);
};
const brandUpload = multer({ storage: brandStorage, fileFilter });

// ---------------- Dashboard & Profile ----------------
router.get('/dashboard/requests', verifyToken, requireRole('brand'), brandController.getMyRequests);
router.get('/dashboard/insights', verifyToken, requireRole('brand'), brandController.getDashboardInsights);

router.get('/overview', verifyToken, requireRole('brand'), brandController.getBrandOverview);
router.get('/me', verifyToken, requireRole('brand'), brandController.getMyProfile);
router.get('/profile', verifyToken, requireRole('brand'), brandController.profile);
router.put('/update', verifyToken, requireRole('brand'), brandController.updateBrandProfile);
router.patch('/upload-profile', verifyToken, requireRole('brand'), brandUpload.single('image'), brandController.uploadProfileImage);

// Single source of truth for influencers list (auth required)
router.get('/influencers', verifyToken, requireRole('brand'), brandController.getAllInfluencers);
router.get('/influencers/:id', verifyToken, requireRole('brand'), brandController.getInfluencerById);

// Public/utility list (if truly needed; otherwise remove)
// router.get('/list', brandController.brandList);

// ---------------- Campaigns CRUD ----------------
router.post('/add-campaign', verifyToken, requireRole('brand'), brandUpload.single('feature_image'), brandController.createCampaign);
router.get('/campaigns-list', verifyToken, requireRole('brand'), brandController.getMyCampaigns);
router.get('/campaigns', verifyToken, requireRole('brand'), brandController.campaign);
router.get('/campaigns/:id', verifyToken, requireRole('brand'), brandController.getCampaignById);
router.put('/campaigns/:id', verifyToken, requireRole('brand'), brandUpload.single('feature_image'), brandController.updateCampaign);
router.patch('/campaigns/:id/draft', verifyToken, requireRole('brand'), brandController.setCampaignToDraft);
router.patch('/campaigns/:id/unpublish', verifyToken, requireRole('brand'), brandController.unpublishCampaign);
router.patch('/campaigns/:id/publish', verifyToken, requireRole('brand'), brandController.publishCampaign);
router.delete('/campaigns/:id', verifyToken, requireRole('brand'), brandController.deleteCampaign);

// ---------------- Applications (UNIFIED) ----------------
/**
 * Unified fetch: all application types (pending, forwarded, brand_forwarded, brand_approved, approved, rejected)
 * Optional query: ?status=pending,forwarded&campaign_id=123&limit=50&offset=0
 */
router.get('/applications', verifyToken, requireRole('brand'), brandController.getAllApplications);

// Back-compat aliases (internally use unified controller)
router.get('/applications/forwarded', verifyToken, requireRole('brand'), (req, res, next) => {
  req.query.status = 'forwarded';
  return brandController.getAllApplications(req, res, next);
});

router.get('/approved-influencers', verifyToken, requireRole('brand'), (req, res, next) => {
  req.query.status = 'approved';
  return brandController.getAllApplications(req, res, next);
});

// Brand decisions over applications
router.post('/applications/:id/decision', verifyToken, requireRole('brand'), brandController.flagApplicationDecision);
// (Optional: keep/update final decision endpoint if you still use it elsewhere)
// router.post('/applications/:id/final-decision', verifyToken, requireRole('brand'), brandController.updateApplicationDecision);

// ---------------- Campaign ↔ Influencers (simple list & attach) ----------------
router.get('/campaigns/:id/influencers', verifyToken, requireRole('brand'), brandController.listCampaignInfluencersSimple);
router.post('/campaigns/:id/influencers/:influencerId', verifyToken, requireRole('brand'), brandController.addInfluencerToCampaign);
router.post('/campaigns/:id/influencers', verifyToken, requireRole('brand'), brandController.addInfluencersToCampaign);

// ---------------- Drive (assets workflow) ----------------
router.get('/campaigns/:id/drive/influencers', verifyToken, requireRole('brand'), drive.listCampaignInfluencers);
router.get('/campaigns/:id/drive', verifyToken, requireRole('brand'), drive.listAssets);
router.get('/drive/thread/:bundleId', verifyToken, requireRole('brand'), drive.getThread);
router.post('/drive/review', verifyToken, requireRole('brand'), drive.reviewAssets);
router.post('/campaigns/:id/drive/request', verifyToken, requireRole('brand'), drive.requestAsset);
router.get('/drive/:fileId/versions', verifyToken, requireRole('brand'), drive.getVersionChain);

// ---------------- Reporting (entries & threads) ----------------
router.post('/campaigns/:id/reports/request', verifyToken, requireRole('brand'), reporting.brandRequestReport);
router.get('/campaigns/:id/reports', verifyToken, requireRole('brand'), reporting.brandListThreads);
router.post('/reports/review', verifyToken, requireRole('brand'), reporting.reviewEntries);
router.get('/reports/entries/:entryId/versions', verifyToken, requireRole('brand'), reporting.getVersionChain);
router.post('/reports/threads/:threadId/comments', verifyToken, requireRole(['brand','admin']), reporting.addComment);
router.post('/reports/entries/:entryId/request', verifyToken, requireRole('brand'), reporting.brandRequestChangesOverEntry);

module.exports = router;
