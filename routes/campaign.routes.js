const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaign.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        const campaign_id = req.body.campaign_id;
        const influencer_id = req.body.influencer_id;
      
        const db = require('../models');
        const campaign = await db.Campaign.findByPk(campaign_id, {
          include: [{ model: db.Brand }]
        });
      
        const influencer = await db.Influencer.findByPk(influencer_id);
      
        const brandName = campaign?.Brand?.company_name || 'brand';
        const influencerName = influencer?.full_name || 'influencer';
      
        const folderPath = `./uploads/campaigns/${brandName}_${influencerName}`.replace(/\s+/g, '');
      
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
        }
      
        cb(null, folderPath);
      },      
    filename: function (req, file, cb) {
      const ext = path.extname(file.originalname);
      const uniqueName = `${Date.now()}-${file.fieldname}${ext}`;
      cb(null, uniqueName);
    }
  });
  
  const upload = multer({ storage });
  
  // Routes
  router.post('/upload-media', verifyToken, upload.single('file'), campaignController.uploadCampaignMedia);
  router.post('/send-message', verifyToken, campaignController.sendMessage);
  
  // router.get('/:campaign_id/messages', verifyToken, campaignController.getMessages);

  router.get('/chat/:campaign_id', verifyToken, campaignController.getChat);
  


router.post('/rate', verifyToken, requireRole('brand'), campaignController.rateInfluencer);
router.post('/rate/admin', verifyToken, requireRole('admin'), campaignController.rateInfluencer);

module.exports = router;
