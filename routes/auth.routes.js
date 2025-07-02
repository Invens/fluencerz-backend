const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Register routes
router.post('/register/influencer', authController.registerInfluencer);
router.post('/register/brand', authController.registerBrand);
router.post('/register/admin', authController.registerAdmin);

// Login route (shared)
router.post('/login', authController.login);

module.exports = router;
