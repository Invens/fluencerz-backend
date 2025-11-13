// routes/refluencedImport.js
const express = require('express');
const router = express.Router();
const refluencedImportController = require('../controllers/refluencedImportController');

// Main import routes
router.post('/import', refluencedImportController.importInfluencersFromRefluenced);
router.post('/import-all', refluencedImportController.importAllData);

// Test routes
router.get('/test', refluencedImportController.testConnection);
router.get('/test-feed', refluencedImportController.testInstagramFeed);
router.get('/test-pagination', refluencedImportController.testAutoPagination);

// Data retrieval routes
router.get('/influencers', refluencedImportController.getImportedInfluencers);
router.get('/influencers/:id', refluencedImportController.getInfluencerWithFullData);
router.get('/stats', refluencedImportController.getImportStats);

// Management routes
router.delete('/cleanup', refluencedImportController.deleteImportedData);

module.exports = router;