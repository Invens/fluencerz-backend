const express = require("express");
const router = express.Router();
const { verifyToken, requireRole } = require("../middleware/auth.middleware");

const ctrl = require("../controllers/InstagramInsight.controller");
const RefreshInsight = require("../controllers/refreshInstagram.controller");

router.get("/auth/instagram",verifyToken, requireRole("influencer"), ctrl.authInstagram);
router.get("/auth/instagram/callback",ctrl.instagramCallback);
router.get("/instagram/data", verifyToken, ctrl.getInstagramData);

router.get("/instagram/media", verifyToken, ctrl.getInstagramMedia);
router.get("/instagram/refresh-insights", verifyToken, requireRole("influencer"), RefreshInsight.refreshInstagramData);

// router.get("/api/profile/:userId", ctrl.getProfile);
// router.get("/api/media/:userId", ctrl.getMediaWithInsights);
// router.get("/api/account-insights/:userId", ctrl.getAccountInsights);

module.exports = router;
