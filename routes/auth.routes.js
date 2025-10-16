// routes/auth.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Public
router.post('/register', auth.register);
router.post('/login', auth.login);
router.post('/login-admin', auth.loginasAdmin);

// Protected
router.get('/me', verifyToken, auth.me);
router.post('/select-type', verifyToken, auth.selectType);
router.put('/brand/onboard', verifyToken, auth.updateBrandProfile);
router.put('/influencer/onboard', verifyToken, auth.updateInfluencerProfile);

module.exports = router;
