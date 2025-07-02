const express = require('express');
const router = express.Router();
const collabController = require('../controllers/collab.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

// ✅ Only brand can send collab request
router.post('/send', verifyToken, requireRole('brand'), collabController.sendRequest);

// ✅ Only admin can update (approve/reject)
router.put('/update/:id', verifyToken, requireRole('admin'), collabController.updateRequestStatus);

// ✅ Only admin can view all collab requests
router.get('/all', verifyToken, requireRole('admin'), collabController.getAllRequests);

module.exports = router;
