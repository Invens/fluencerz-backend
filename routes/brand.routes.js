const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brand.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
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

module.exports = router;