const db = require('../models');
const CampaignMediaFile = db.CampaignMediaFile;
const CampaignApplication = db.CampaignApplication;
const CampaignMessage = db.CampaignMessage;
const Brand = db.Brand;
const Influencer = db.Influencer;

/**
 * Upload campaign media (brand/influencer only
 */
exports.uploadCampaignMedia = async (req, res) => {
  try {
    const { campaign_id, visibility } = req.body;
    const userId = req.user.id;
    const userType = req.user.userType;

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // ✅ Verify campaign is approved (skip for admin)
    if (userType !== 'admin') {
      const application = await CampaignApplication.findOne({
        where: { campaign_id, status: 'approved' },
      });

      if (!application) {
        return res.status(403).json({
          message: 'Media upload allowed only for approved campaigns',
        });
      }
    }

    const file_path = req.file.path.replace(/\\/g, '/');
    const file_type = req.file.mimetype;

    const media = await CampaignMediaFile.create({
      uploader_type: userType,
      uploader_id: userId,
      campaign_id,
      file_path,
      file_type,
      visibility: visibility || 'both',
      is_approved: userType === 'admin' ? true : false, // auto-approve for admin
    });

    res.status(201).json({ message: 'Media uploaded successfully', media });
  } catch (err) {
    console.error('❌ Error uploading campaign media:', err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * Send chat message (brand, influencer, admin)
 */
exports.sendMessage = async (req, res) => {
  try {
    const { campaign_id, message, receiver_id } = req.body;
    const sender_id = req.user.id;
    const sender_type = req.user.userType;

    // ✅ Verify campaign is approved (skip for admin)
    if (sender_type !== 'admin') {
      const application = await CampaignApplication.findOne({
        where: { campaign_id, status: 'approved' },
      });

      if (!application) {
        return res.status(403).json({
          message: 'Chat allowed only for approved campaigns',
        });
      }
    }

    const msg = await CampaignMessage.create({
      campaign_id,
      sender_type,
      sender_id,
      receiver_id: receiver_id || null,
      message,
      is_approved: sender_type === 'admin' ? true : false, // auto-approve for admin
    });

    res.status(201).json({ message: 'Message sent successfully', data: msg });
  } catch (err) {
    console.error('❌ Error sending campaign message:', err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

/**
 * Get all chat items (messages + media) for a campaign
 */
/**
 * Get all chat items (messages + media) for a campaign
 */
exports.getChat = async (req, res) => {
  try {
    const { campaign_id } = req.params;

    // Fetch campaign with brand + influencer
    const campaign = await db.Campaign.findByPk(campaign_id, {
      include: [
        { model: db.Brand, attributes: ['id', 'company_name', 'profile_picture'] },
        {
          model: db.CampaignApplication,
          where: { status: 'approved' },
          required: false,
          include: [
            { model: db.Influencer, attributes: ['id', 'full_name', 'profile_image'] },
          ],
        },
      ],
    });

    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Fetch messages
    const messages = await db.CampaignMessage.findAll({
      where: { campaign_id },
      order: [['created_at', 'ASC']],
    });

    // Fetch media
    const mediaFiles = await db.CampaignMediaFile.findAll({
      where: { campaign_id },
      order: [['uploaded_at', 'ASC']],
    });

    // Normalize both into same structure
    const chatItems = [
      ...messages.map((m) => ({
        ...m.toJSON(),
        type: 'message',
        sender_type: m.sender_type,
        sender_id: m.sender_id,
        created_at: m.created_at,
      })),
      ...mediaFiles.map((f) => ({
        ...f.toJSON(),
        type: 'media',
        sender_type: f.uploader_type, // normalize uploader → sender
        sender_id: f.uploader_id,
        message: null,
        created_at: f.uploaded_at, // unify timestamp key
      })),
    ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    res.json({
      success: true,
      campaign: {
        id: campaign.id,
        title: campaign.title,
        campaign_status: campaign.campaign_status,
        Brand: campaign.Brand,
        Influencer: campaign.CampaignApplications?.[0]?.Influencer || null,
      },
      data: chatItems,
    });
  } catch (err) {
    console.error('❌ Error fetching chat:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};


/**
 * Rate influencer (only after campaign completion)
 */
exports.rateInfluencer = async (req, res) => {
  try {
    const { campaign_id, rating_value, review } = req.body;
    const rated_by = req.user.role; // 'admin' or 'brand'

    const campaign = await db.Campaign.findByPk(campaign_id);
    if (!campaign || campaign.campaign_status !== 'completed') {
      return res.status(400).json({
        message: 'Rating only allowed after campaign completion.',
      });
    }

    const existing = await db.Rating.findOne({
      where: { campaign_id, rated_by },
    });

    if (existing) {
      return res
        .status(400)
        .json({ message: 'You already rated this campaign.' });
    }

    const rating = await db.Rating.create({
      campaign_id,
      rated_by,
      rating_value,
      review,
    });

    res
      .status(201)
      .json({ message: 'Rating submitted successfully', rating });
  } catch (err) {
    console.error('❌ Error rating influencer:', err);
    res.status(500).json({ message: err.message });
  }
};
