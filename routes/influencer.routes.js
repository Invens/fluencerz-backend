// routes/influencer.js
const express = require('express');
const router = express.Router();

const influencerController = require('../controllers/influencer.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

const driveUpload = require('../middleware/uploadDrive');
const drive = require('../controllers/drive.controller');

const upload = require('../middleware/upload'); // generic single-file upload (proofs, etc.)

const reporting = require('../controllers/reporting.controller');

// Instagram helpers (already implemented in your codebase)
const instagram = require('../controllers/InstagramInsight.controller'); 
// must export: getInstagramMedia, refreshInstagramData

/* ===========================
   CORE INFLUENCER ROUTES
   =========================== */

// Notifications
router.get('/notifications', verifyToken, requireRole('influencer'), influencerController.getNotifications);
router.put('/notifications/:id', verifyToken, requireRole('influencer'), influencerController.markNotificationAsRead);

// Profile & Overview
router.get('/campaigns', verifyToken, requireRole('influencer'), influencerController.getMyCampaigns);
router.get('/last-collab', verifyToken, requireRole('influencer'), influencerController.getLastCollab);
router.get('/overview', verifyToken, requireRole('influencer'), influencerController.overview);
router.get('/me', verifyToken, requireRole('influencer'), influencerController.getMyProfile);
router.put('/update', verifyToken, requireRole('influencer'), influencerController.updateMyProfile);
router.patch('/upload-profile', verifyToken, requireRole('influencer'), upload.single('image'), influencerController.uploadProfileImage);

// Discovery / Feed
router.get('/influencer-filter', influencerController.influencer);
router.get('/campaigns/feed', verifyToken, requireRole('influencer'), influencerController.getCampaignFeed);
router.get('/campaigns/:id', verifyToken, requireRole('influencer'), influencerController.getSingleCampaign);

// NOTE: If you require IG connection before apply, enforce it inside controller
router.post('/campaigns/:id/apply', verifyToken, requireRole('influencer'), influencerController.applyToCampaign);
router.get('/applied-campaigns', verifyToken, requireRole('influencer'), influencerController.getAppliedCampaigns);

/* ===========================
   DRIVE (existing)
   =========================== */

// Upload drive assets (multi) – creates a new thread
router.post(
  '/campaigns/:id/drive',
  verifyToken, requireRole('influencer'),
  driveUpload.array('files', 20),
  drive.uploadAssets
);

// List own drive threads for a campaign
router.get(
  '/campaigns/:id/drive',
  verifyToken, requireRole('influencer'),
  drive.listAssets
);

// Replace / new version
router.post(
  '/drive/:fileId/replace',
  verifyToken, requireRole('influencer'),
  driveUpload.single('file'),
  drive.replaceAsset
);

// Drive versions & restore
router.get('/drive/:fileId/versions', verifyToken, requireRole('influencer'), drive.getVersionChain);
router.post('/drive/:fileId/restore', verifyToken, requireRole('influencer'), drive.restoreVersion);

// Optional: Single thread view (drive)
router.get('/drive/thread/:bundleId', verifyToken, requireRole('influencer'), drive.getThread);

/* ===========================
   REPORTING (new)
   =========================== */

// List my report threads for a campaign
router.get(
  '/campaigns/:id/reports',
  verifyToken, requireRole('influencer'),
  reporting.influencerListThreads
);

// Submit MANUAL report (creates new thread OR appends new version to existing thread)
// Canonical: include campaign id in URL. Body may include thread_id to append.
router.post(
  '/campaigns/:id/reports',
  verifyToken, requireRole('influencer'),
  reporting.submitManualReport
);

// Submit INSTAGRAM report (select from cached media)
// Canonical: include campaign id in URL. Body must include media_ids[].
router.post(
  '/campaigns/:id/reports/instagram',
  verifyToken, requireRole('influencer'),
  reporting.submitInstagramReport
);

// (Optional backward-compat: id-less forms; pass { campaign_id } in body)
router.post('/reports/manual', verifyToken, requireRole('influencer'), reporting.submitManualReport);
router.post('/reports/instagram', verifyToken, requireRole('influencer'), reporting.submitInstagramReport);

// Read a single report thread
router.get(
  '/reports/threads/:threadId',
  verifyToken, requireRole('influencer'),
  reporting.getThread
);

// Replace a report entry by creating a new version (manual proof/screenshot etc.)
router.post(
  '/reports/:entryId/replace',
  verifyToken, requireRole('influencer'),
  upload.single('file'), // if you need a file; else remove
  reporting.replaceReportEntry
);

// Report versions & restore
router.get('/reports/entries/:entryId/versions', verifyToken, requireRole('influencer'), reporting.getVersionChain);
router.post('/reports/entries/:entryId/restore', verifyToken, requireRole('influencer'), reporting.restoreReportVersion);

// Add a comment in a report thread
router.post('/reports/threads/:threadId/comments', verifyToken, requireRole('influencer'), reporting.addComment);

/* ===========================
   INSTAGRAM helpers (used by report media picker)
   =========================== */
router.get('/instagram/media', verifyToken, requireRole('influencer'), instagram.getInstagramMedia);
router.post('/instagram/refresh', verifyToken, requireRole('influencer'), instagram.refreshInstagramData);

module.exports = router;
