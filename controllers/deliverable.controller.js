// controllers/deliverable.controller.js
const db = require('../models');
const { Campaign, CampaignDeliverable, CampaignApplication, DeliverableComment } = db;
const { validateMetrics, safeParseJSON } = require('../utils/metrics');

exports.submitDeliverable = async (req, res) => {
  try {
    const influencerId = req.user.id;
    const campaignId = Number(req.params.id);
    const {
      platform, media_type, permalink, metrics, tags, notes, cover_image, tracking
    } = req.body;

    // Ensure campaign exists
    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });

    // OPTIONAL: ensure influencer has an approved application for this campaign
    const approved = await CampaignApplication.findOne({
      where: { campaign_id: campaignId, influencer_id: influencerId, status: 'approved' }
    });
    if (!approved) {
      // If you want to allow reports for active+closed regardless, comment this
      return res.status(403).json({ success: false, message: 'You are not approved for this campaign' });
    }

    const metricsObj = safeParseJSON(metrics, {});
    const tagsArr = safeParseJSON(tags, []);
    const trackingObj = safeParseJSON(tracking, {});

    const deliverable = await CampaignDeliverable.create({
      campaign_id: campaignId,
      influencer_id: influencerId,
      platform,
      media_type,
      permalink: permalink || null,
      proof_file: req.file ? `/uploads/deliverables/${req.file.filename}` : null,
      cover_image: cover_image || null,
      metrics: validateMetrics(media_type, metricsObj),
      tracking: trackingObj,
      tags: Array.isArray(tagsArr) ? tagsArr : [],
      notes: notes || null,
      status: 'submitted',
      submitted_at: new Date(),
      updated_at: new Date(),
    });

    res.json({ success: true, data: deliverable });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.updateOwnDeliverable = async (req, res) => {
  try {
    const influencerId = req.user.id;
    const deliverableId = Number(req.params.deliverableId);
    const d = await CampaignDeliverable.findByPk(deliverableId);
    if (!d || d.influencer_id !== influencerId) {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }
    if (['approved'].includes(d.status)) {
      return res.status(400).json({ success: false, message: 'Cannot edit after approval' });
    }

    const {
      platform, media_type, permalink, metrics, tags, notes, cover_image, tracking
    } = req.body;

    const updates = {};
    if (platform) updates.platform = platform;
    if (media_type) updates.media_type = media_type;
    if (permalink !== undefined) updates.permalink = permalink || null;
    if (cover_image !== undefined) updates.cover_image = cover_image || null;
    if (notes !== undefined) updates.notes = notes || null;

    if (metrics !== undefined) {
      const m = safeParseJSON(metrics, {});
      updates.metrics = validateMetrics(media_type || d.media_type, m);
    }
    if (tracking !== undefined) {
      updates.tracking = safeParseJSON(tracking, {});
    }
    if (tags !== undefined) {
      const arr = safeParseJSON(tags, []);
      updates.tags = Array.isArray(arr) ? arr : [];
    }

    if (req.file) updates.proof_file = `/uploads/deliverables/${req.file.filename}`;
    updates.updated_at = new Date();

    await d.update(updates);
    res.json({ success: true, data: d });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/** Influencer: list own deliverables for a campaign */
exports.getMyDeliverablesForCampaign = async (req, res) => {
  try {
    const influencerId = req.user.id;
    const campaignId = Number(req.params.id);
    const list = await CampaignDeliverable.findAll({
      where: { campaign_id: campaignId, influencer_id: influencerId },
      order: [['submitted_at','DESC']]
    });
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/** Brand: list all deliverables for a campaign */
exports.getCampaignDeliverables = async (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    const list = await CampaignDeliverable.findAll({
      where: { campaign_id: campaignId },
      include: [{ model: db.Influencer, attributes: ['id','full_name','profile_image','niche','followers_count','engagement_rate'] }],
      order: [['submitted_at','DESC']]
    });
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
