// controllers/deliverable.controller.js
const { Campaign, CampaignDeliverable } = require('../models');
const { validateMetrics } = require('../utils/metrics');

exports.submitDeliverable = async (req, res) => {
  try {
    const influencerId = req.user.id;
    const campaignId = Number(req.params.id);
    const {
      platform, media_type, permalink, metrics, tags, notes, cover_image, tracking
    } = req.body;

    // check influencer belongs to an approved application for this campaign if you track that
    await Campaign.findByPk(campaignId, { rejectOnEmpty: true });

    const metricsObj = metrics ? JSON.parse(metrics) : {};
    const tagsArr = tags ? JSON.parse(tags) : [];
    const trackingObj = tracking ? JSON.parse(tracking) : {};

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
      return res.status(403).json({ message: 'Not allowed' });
    }
    if (['approved','rejected'].includes(d.status)) {
      return res.status(400).json({ message: 'Cannot edit after review' });
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
    if (metrics) updates.metrics = validateMetrics(media_type || d.media_type, JSON.parse(metrics));
    if (tracking) updates.tracking = JSON.parse(tracking);
    if (tags) updates.tags = Array.isArray(JSON.parse(tags)) ? JSON.parse(tags) : [];

    if (req.file) updates.proof_file = `/uploads/deliverables/${req.file.filename}`;

    await d.update(updates);
    res.json({ success: true, data: d });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
