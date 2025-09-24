// controllers/report.controller.js
const db = require('../models');
const { Campaign, CampaignDeliverable, Influencer, DeliverableComment } = db;
const { renderCampaignReportHTML, pdfFromHTML } = require('../utils/reportPdf');

async function aggregateCampaign(campaignId) {
  const campaign = await Campaign.findByPk(campaignId);
  if (!campaign) throw new Error('Campaign not found');

  const deliverables = await CampaignDeliverable.findAll({
    where: { campaign_id: campaignId },
    include: [{ model: Influencer, attributes: ['id','full_name','profile_image','niche','followers_count','engagement_rate'] }]
  });

  const totals = {
    deliverables: deliverables.length,
    reach: 0, impressions: 0, likes: 0, comments: 0, saves: 0, shares: 0, views: 0, profile_visits: 0
  };
  const byInfluencer = {};

  for (const d of deliverables) {
    const m = d.metrics || {};
    for (const k of Object.keys(totals)) {
      if (k === 'deliverables') continue;
      totals[k] += Number(m[k] || 0);
    }
    const key = d.Influencer?.id || 'unknown';
    if (!byInfluencer[key]) {
      byInfluencer[key] = {
        influencer: d.Influencer,
        items: [],
        subtotals: { reach:0, impressions:0, likes:0, comments:0, saves:0, shares:0, views:0, profile_visits:0 }
      };
    }
    byInfluencer[key].items.push(d);
    for (const k of Object.keys(byInfluencer[key].subtotals)) {
      byInfluencer[key].subtotals[k] += Number(m[k] || 0);
    }
  }

  return { campaign, totals, deliverables, byInfluencer };
}

exports.getCampaignReport = async (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    const data = await aggregateCampaign(campaignId);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.reviewDeliverable = async (req, res) => {
  try {
    const deliverableId = Number(req.params.deliverableId);
    const { decision, comment } = req.body; // 'approved' | 'rejected' | 'needs_changes'
    const d = await CampaignDeliverable.findByPk(deliverableId);
    if (!d) return res.status(404).json({ success: false, message: 'Deliverable not found' });

    if (!['approved','rejected','needs_changes'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Invalid decision' });
    }

    await d.update({ status: decision, reviewed_at: new Date(), updated_at: new Date() });

    if (comment) {
      await DeliverableComment.create({
        deliverable_id: d.id,
        author_role: req.user.role,
        author_id: req.user.id,
        comment
      });
    }
    res.json({ success: true, data: d });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.exportCampaignReportPDF = async (req, res) => {
  try {
    const campaignId = Number(req.params.id);
    const data = await aggregateCampaign(campaignId);

    const html = await renderCampaignReportHTML(data);
    const pdfBuffer = await pdfFromHTML(html);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=campaign_${campaignId}_report.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
