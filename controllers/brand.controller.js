const db = require('../models');
const axios = require("axios");
const fs = require('fs'); // Added for directory creation
const path = require('path'); // Added for path handling
const Campaign = db.Campaign;
const CampaignApplication = db.CampaignApplication;
const Influencer = db.Influencer;
const InfluencerInstagramAccount = db.InfluencerInstagramAccount;
const CampaignDeliverable = db.CampaignDeliverable;
const { Op } = db.Sequelize; // Added for Op.in query
const { getActor } = require('./_authUtils');

// Ensure upload directory exists
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'brands');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log('📁 Created upload directory:', UPLOAD_DIR);
}

// ✅ Update brand profile (phone, skype, industry, website)
exports.updateBrandProfile = async (req, res) => {
  try {
    const brandId = req.user.id;

    const { phone, skype, industry, website } = req.body;

    const brand = await db.Brand.findByPk(brandId);
    if (!brand) return res.status(404).json({ message: 'Brand not found' });

    brand.phone = phone || brand.phone;
    brand.skype = skype || brand.skype;
    brand.industry = industry || brand.industry;
    brand.website = website || brand.website;

    await brand.save();

    res.status(200).json({ message: 'Profile updated successfully', brand });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const brand = await db.Brand.findByPk(req.user.id);
    if (!brand) return res.status(404).json({ message: 'Brand not found' });

    brand.profile_image = `/uploads/brands/${req.file.filename}`;
    await brand.save();

    res.status(200).json({ message: 'Image uploaded', path: brand.profile_image });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getMyRequests = async (req, res) => {
  try {
    const brandId = req.user.id;

    const requests = await db.CollabRequest.findAll({
      where: { brand_id: brandId },
      include: [
        {
          model: db.Influencer,
          attributes: ['id', 'full_name', 'email', 'niche', 'followers_count']
        },
        {
          model: db.Campaign,
          attributes: ['id', 'campaign_status', 'quotation_amount', 'start_date', 'end_date']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({ message: 'Your collaboration requests', data: requests });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getBrandOverview = async (req, res) => {
  try {
    const brandId = req.user.id;

    // Collab Requests Summary
    const requests = await db.CollabRequest.findAll({
      where: { brand_id: brandId },
      attributes: ['status']
    });

    // Campaign Summary
    const campaigns = await db.Campaign.findAll({
      include: {
        model: db.CollabRequest,
        where: { brand_id: brandId },
        attributes: []
      },
      attributes: ['campaign_status']
    });

    const requestStats = {
      total: requests.length,
      approved: requests.filter(r => r.status === 'approved').length,
      rejected: requests.filter(r => r.status === 'rejected').length,
      pending: requests.filter(r => r.status === 'pending').length
    };

    const campaignStats = {
      in_progress: campaigns.filter(c => c.campaign_status === 'in_progress').length,
      completed: campaigns.filter(c => c.campaign_status === 'completed').length
    };

    res.json({ requests: requestStats, campaigns: campaignStats });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.influencers = async (req, res) => {
  try {
    const influencers = await db.Influencer.findAll({
      attributes: ['id', 'full_name', 'niche', 'followers_count', 'social_platforms', 'profile_image']
    });
    res.json(influencers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.campaign = async (req, res) => {
  try {
    const brandId = req.user.id;

    const campaigns = await db.Campaign.findAll({
      include: {
        model: db.CollabRequest,
        where: { brand_id: brandId },
        include: {
          model: db.Influencer,
          attributes: ['full_name', 'email']
        }
      },
      order: [['start_date', 'DESC']]
    });

    res.json({ message: 'Your campaigns', data: campaigns });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.ratings = async (req, res) => {
  try {
    const brandId = req.user.id;

    const campaigns = await db.Campaign.findAll({
      where: { campaign_status: 'completed' },
      include: [
        {
          model: db.CollabRequest,
          where: { brand_id: brandId },
          include: { model: db.Influencer, attributes: ['full_name', 'email'] }
        },
        {
          model: db.Rating,
          where: { rated_by: 'brand' },
          required: false
        }
      ],
      order: [['end_date', 'DESC']]
    });

    res.json({ message: 'Completed campaigns for brand rating', data: campaigns });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.addRating = async (req, res) => {
  try {
    const { campaign_id, rating_value, review } = req.body;

    const existing = await db.Rating.findOne({
      where: { campaign_id, rated_by: 'brand' }
    });

    if (existing) {
      existing.rating_value = rating_value;
      existing.review = review;
      await existing.save();
      return res.json({ message: 'Rating updated successfully' });
    }

    await db.Rating.create({
      campaign_id,
      rated_by: 'brand',
      rating_value,
      review
    });

    res.status(201).json({ message: 'Rating submitted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /brand/profile
 * Returns a slimmed/selected set of fields.
 * Works with:
 *  - new flow (Users.id in JWT, Brand linked via auth_user_id)
 *  - legacy flow (Brand.id in JWT) -> auto-bridges to auth_user_id
 *  - email fallback (if not linked yet)
 */
exports.profile = async (req, res) => {
  try {
    const { brand } = await getActor(db, req);
    if (!brand) return res.status(404).json({ message: 'Brand not found' });

    const b = brand.toJSON ? brand.toJSON() : brand;

    // Keep the response schema stable
    const data = {
      company_name: b.company_name ?? null,
      contact_person: b.contact_person ?? null,
      email: b.email ?? null,
      phone: b.phone ?? '',
      skype: b.skype ?? '',
      industry: b.industry ?? null,
      website: b.website ?? null,
      profile_image: b.profile_image ?? b.logo_url ?? null,
    };

    return res.json({ message: 'Brand profile fetched', data });
  } catch (err) {
    console.error('brand profile error:', err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

/**
 * GET /brand/me
 * Returns the full brand record (minus secrets) for internal screens.
 * Same bridging behavior as above.
 */
exports.getMyProfile = async (req, res) => {
  try {
    const { brand } = await getActor(db, req);
    if (!brand) return res.status(404).json({ message: 'Brand not found.' });

    const data = brand.toJSON ? brand.toJSON() : brand;
    delete data.password_hash; // never expose

    return res.status(200).json(data);
  } catch (err) {
    console.error('brand getMyProfile error:', err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

exports.brandList = async (req, res) => {
  try {
    const brand = await db.Brand.findAll({
      attributes: [
        'company_name',
        'profile_image'
      ]
    });

    if (!brand) return res.status(404).json({ message: 'Brand not found' });

    res.json({ message: 'Brand profile fetched', data: brand });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createCampaign = async (req, res) => {
  try {
    const brandId = req.user.id; // From auth middleware
    const {
      title,
      description,
      brief_link,
      media_kit_link,
      platform,
      content_type,
      eligibility_criteria,
      campaign_requirements,
      guidelines_do,
      guidelines_donot,
      budget, // New field
      influencer_ids, // optional array
    } = req.body;

    // Fixed: Handle req.file safely with logging
    let feature_image = null;
    if (req.file) {
      console.log('📁 File received:', req.file.filename, req.file.size, 'bytes');
      feature_image = `/uploads/brands/${req.file.filename}`;
    } else {
      console.log('⚠️ No file uploaded for feature_image');
    }

    const parseField = (field) => {
      if (!field) return null;
      try {
        return typeof field === "string" ? JSON.parse(field) : field;
      } catch {
        return field;
      }
    };

    // Create campaign
    const campaign = await Campaign.create({
      brand_id: brandId,
      title,
      description,
      brief_link,
      media_kit_link,
      platform,
      content_type,
      eligibility_criteria: parseField(eligibility_criteria),
      campaign_requirements: parseField(campaign_requirements),
      guidelines_do: parseField(guidelines_do),
      guidelines_donot: parseField(guidelines_donot),
      budget: budget ? parseFloat(budget) : null, // Parse as decimal
      feature_image,
      status: "published",
    });

    // If brand assigned influencers, create applications
    if (influencer_ids) {
      const ids = JSON.parse(influencer_ids);
      if (Array.isArray(ids) && ids.length > 0) {
        const apps = ids.map((iid) => ({
          influencer_id: iid,
          campaign_id: campaign.id,
          status: "approved", // ✅ forwarded by brand
          forwardedBy: "brand",
        }));
        await CampaignApplication.bulkCreate(apps);
      }
    }

    res.status(201).json({
      success: true,
      message: "Campaign created successfully!",
      data: campaign,
    });
  } catch (err) {
    console.error("❌ Error creating campaign:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ----------------- GET BRAND CAMPAIGNS -----------------
exports.getMyCampaigns = async (req, res) => {
  try {
    const brandId = req.user.id;

    const campaigns = await db.Campaign.findAll({
      where: { brand_id: brandId },
      order: [['created_at', 'DESC']],
    });

    res.json({ success: true, data: campaigns });
  } catch (err) {
    console.error('❌ Error fetching campaigns:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Update Campaign (with influencers update optional)
exports.updateCampaign = async (req, res) => {
  try {
    const brandId = req.user.id;
    const campaignId = req.params.id;

    const campaign = await Campaign.findOne({
      where: { id: campaignId, brand_id: brandId },
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    // Fixed: Handle req.file safely with logging
    let feature_image = campaign.feature_image;
    if (req.file) {
      console.log('📁 File received for update:', req.file.filename, req.file.size, 'bytes');
      feature_image = `/uploads/brands/${req.file.filename}`;
    } else {
      console.log('⚠️ No new file uploaded for feature_image update');
    }

    const {
      title,
      description,
      brief_link,
      media_kit_link,
      platform,
      content_type,
      budget,
      eligibility_criteria,
      campaign_requirements,
      guidelines_do,
      guidelines_donot,
      status,
      influencer_ids, // optional
    } = req.body;

    const parseField = (field) => {
      if (!field) return null;
      try {
        return typeof field === "string" ? JSON.parse(field) : field;
      } catch {
        return field;
      }
    };

    await campaign.update({
      title,
      description,
      brief_link,
      media_kit_link,
      platform,
      budget,
      content_type,
      eligibility_criteria: parseField(eligibility_criteria),
      campaign_requirements: parseField(campaign_requirements),
      guidelines_do: parseField(guidelines_do),
      guidelines_donot: parseField(guidelines_donot),
      feature_image,
      status: status || campaign.status,
    });

    // ✅ Handle influencers update
    if (influencer_ids) {
      const ids = JSON.parse(influencer_ids);
      if (Array.isArray(ids)) {
        // Remove old forwarded applications
        await CampaignApplication.destroy({
          where: { campaign_id: campaign.id, status: "forwarded" },
        });

        // Ensure unique IDs to prevent duplicates
        const uniqueIds = [...new Set(ids)];

        // Insert new forwarded applications
        const apps = uniqueIds.map((iid) => ({
          influencer_id: iid,
          campaign_id: campaign.id,
          status: "approved",
          forwardedBy: "brand",
        }));
        await CampaignApplication.bulkCreate(apps, { ignoreDuplicates: true });
      }
    }

    res.json({
      success: true,
      message: "Campaign updated successfully!",
      data: campaign,
    });
  } catch (err) {
    console.error("❌ Error updating campaign:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCampaignApplications = async (req, res) => {
  try {
    const brandId = req.user?.brand_id ?? req.user?.id;

    // ✅ 1. Get campaigns owned by the brand
    const campaigns = await Campaign.findAll({
      where: { brand_id: brandId },
      attributes: ['id', 'title', 'status']
    });

    const campaignIds = campaigns.map(c => c.id);

    if (campaignIds.length === 0) {
      return res.json({
        message: 'No campaigns found for this brand',
        campaigns: []
      });
    }

    // ✅ 2. Fetch applications with status pending OR approved
    const applications = await CampaignApplication.findAll({
      where: {
        campaign_id: { [Op.in]: campaignIds },
        status: { [Op.in]: ['approved', 'pending'] }
      },
      include: [
        {
          model: db.Campaign,
          attributes: ['id', 'title', 'status'],
          where: { brand_id: brandId }
        },
        {
          model: db.Influencer,
          attributes: [
            'id',
            'full_name',
            'profile_image',
            'niche',
            'followers_count',
            'engagement_rate',
            'social_platforms',
            'followers_by_country',
            'audience_age_group',
            'audience_gender',
            'total_reach',
            'portfolio',
            'availability',
            'created_at'
          ],
          include: [
            {
              model: db.InfluencerInstagramAccount,
              as: 'instagramAccount',
              required: false,
              attributes: {
                exclude: ['username', 'email', 'access_token'] // 🚫 keep it safe
              }
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // ✅ 3. Group influencers by campaign and status
    const grouped = {};
    campaigns.forEach(c => {
      grouped[c.id] = {
        id: c.id,
        title: c.title,
        status: c.status,
        approved: [],
        pending: []
      };
    });

    applications.forEach(app => {
      const campaignId = app.Campaign.id;
      if (grouped[campaignId]) {
        if (app.status === 'approved') {
          grouped[campaignId].approved.push(app.Influencer);
        } else if (app.status === 'pending') {
          grouped[campaignId].pending.push(app.Influencer);
        }
      }
    });

    // ✅ 4. Return the grouped result
    return res.json({
      message: 'Campaign applications grouped by status',
      campaigns: Object.values(grouped)
    });
  } catch (err) {
    console.error('❌ Error fetching campaign applications:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};
/**
 * Brand makes final decision (approve/reject)
 */
exports.updateApplicationDecision = async (req, res) => {
  try {
    const { id } = req.params; // application id
    const { decision } = req.body; // 'approved' or 'rejected'

    const app = await CampaignApplication.findByPk(id, {
      include: [{ model: Campaign }]
    });

    if (!app || app.Campaign.brand_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (app.status !== 'forwarded') {
      return res.status(400).json({ message: 'Only forwarded applications can be decided by brand' });
    }

    app.status = decision;
    await app.save();

    res.json({ success: true, message: `Application ${decision}`, application: app });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Brand reviews only forwarded applications
exports.flagApplicationDecision = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision } = req.body; // brand_approved | rejected

    const app = await db.CampaignApplication.findByPk(id, {
      include: [{ model: db.Campaign }],
    });

    if (!app || app.Campaign.brand_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    if (app.status !== 'forwarded') {
      return res.status(400).json({ message: 'Only forwarded apps can be reviewed by brand' });
    }

    if (!['brand_approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ message: 'Invalid decision' });
    }

    app.status = decision;
    await app.save();

    res.json({
      success: true,
      message: `Application flagged as ${decision} by brand`,
      application: app,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Show forwarded applications to brand
exports.getForwardedApplications = async (req, res) => {
  try {
    // Prefer the brand_id embedded in your JWT; fallback to req.user.id for legacy
    const brandId =
      req.user?.brand_id ??
      req.user?.id ??
      null;

    if (!brandId) {
      return res.status(400).json({ message: 'Brand context missing (no brand_id on token).' });
    }

    // Optional pagination from query
    const limit  = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    // We want all 3 statuses
    const STATUSES = ['pending', 'brand_forwarded', 'forwarded'];

    const apps = await db.CampaignApplication.findAll({
      where: { status: { [Op.in]: STATUSES } },
      include: [
        {
          model: db.Campaign,
          where: { brand_id: brandId },
          attributes: ['id', 'title', 'status', 'description']
        },
        {
          model: db.Influencer,
          attributes: [
            'id',
            'full_name',
            'profile_image',
            'niche',
            'followers_count',
            'engagement_rate',
            'social_platforms',
            'followers_by_country',
            'audience_age_group',
            'audience_gender',
            'total_reach',
            'portfolio',
            'availability',
            'created_at'
          ],
          include: [
            {
              model: db.InfluencerInstagramAccount,
              as: 'instagramAccount',
              required: false,
              attributes: {
                // keep sensitive stuff out
                exclude: ['username', 'email', 'access_token', 'refresh_token']
              }
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    // Group by status for a clean response
    const grouped = {
      pending: [],
      brand_forwarded: [],
      forwarded: []
    };
    for (const a of apps) {
      const s = a.status;
      if (grouped[s]) grouped[s].push(a);
    }

    // Optional: include simple counts
    const totals = {
      pending: grouped.pending.length,
      brand_forwarded: grouped.brand_forwarded.length,
      forwarded: grouped.forwarded.length,
      all: apps.length
    };

    console.log('[Brand Apps] brand_id:', brandId, 'totals:', totals, 'limit/offset:', { limit, offset });

    return res.json({
      success: true,
      totals,
      data: grouped
    });
  } catch (err) {
    console.error('[Brand Apps] error:', err);
    return res.status(500).json({ message: err.message || 'Internal server error' });
  }
};

exports.getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await db.Campaign.findOne({
      where: { id, brand_id: req.user.id }, // ensure brand can only see its own
      include: [
        {
          model: db.CampaignApplication,
          attributes: ["id", "status", "applied_at"],
          include: [
            {
              model: db.Influencer,
              attributes: ["id", "full_name", "profile_image", "followers_count", "engagement_rate"],
            },
          ],
        },
      ],
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    res.json({ success: true, data: campaign });
  } catch (err) {
    console.error("❌ getCampaignById error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/brand/influencers
 * Fetch all influencers with basic details
 */
exports.getAllInfluencers = async (req, res) => {
  try {
    const influencers = await Influencer.findAll({
      attributes: [
        'id',
        'full_name',
        'email',
        'niche',
        'followers_count',
        'engagement_rate',
        'total_reach',
        'availability',
        'profile_image',
        'profile_picture_url',
      ],
      include: [
        {
          model: InfluencerInstagramAccount,
          as: 'instagramAccount',
          attributes: [
            'id',
            'username',
            'followers_count',
            'engagement_rate',
            'avg_reach',
            'avg_views',
            'avg_likes',
            'avg_comments',
            'total_engagements'
          ]
        }
      ],
      order: [['followers_count', 'DESC']], // Sort by biggest reach
    });

    res.json({ success: true, data: influencers });
  } catch (err) {
    console.error('❌ Error fetching influencers:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * GET /api/brand/influencers/:id
 * Fetch influencer details by ID
 */
exports.getInfluencerById = async (req, res) => {
  try {
    const { id } = req.params;

    const influencer = await Influencer.findByPk(id, {
      include: [
        {
          model: InfluencerInstagramAccount,
          as: 'instagramAccount',
          attributes: [
            'id',
            'username',
            'followers_count',
            'engagement_rate',
            'avg_reach',
            'avg_views',
            'avg_likes',
            'avg_comments',
            'total_engagements',
            'account_insights_day',
            'account_insights_30days',
            'media_with_insights'
          ]
        }
      ]
    });

    if (!influencer) {
      return res.status(404).json({ success: false, message: 'Influencer not found' });
    }

    res.json({ success: true, data: influencer });
  } catch (err) {
    console.error('❌ Error fetching influencer by ID:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getDashboardInsights = async (req, res) => {
  try {
    const brandId = req.user.id;

    const campaigns = await db.Campaign.findAll({
      where: { brand_id: brandId },
      attributes: ['id', 'title', 'status', 'created_at'], // 👈 FIX: status not campaign_status
      include: [
        {
          model: db.CampaignDeliverable,
          as: 'deliverables',
          attributes: ['id', 'metrics', 'status']
        }
      ]
    });

    if (!campaigns || campaigns.length === 0) {
      return res.json({
        success: true,
        data: {
          totalCampaigns: 0,
          activeCampaigns: 0,
          closedCampaigns: 0,
          deliverables: 0,
          reach: 0,
          impressions: 0,
          likes: 0,
          comments: 0,
          saves: 0,
          shares: 0,
          views: 0,
          campaigns: []
        }
      });
    }

    // Initialize totals
    const totals = {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter(c => c.status === 'published').length,
      closedCampaigns: campaigns.filter(c => c.status === 'closed').length,
      deliverables: 0,
      reach: 0,
      impressions: 0,
      likes: 0,
      comments: 0,
      saves: 0,
      shares: 0,
      views: 0,
      campaigns: []
    };

    // Per-campaign stats
    campaigns.forEach(c => {
      const stats = {
        id: c.id,
        title: c.title,
        status: c.status, // 👈 FIX here also
        created_at: c.created_at,
        deliverables: c.deliverables?.length || 0,
        reach: 0,
        impressions: 0,
        likes: 0,
        comments: 0,
        saves: 0,
        shares: 0,
        views: 0
      };

      (c.deliverables || []).forEach(d => {
        const m = d.metrics || {};
        stats.reach += Number(m.reach || 0);
        stats.impressions += Number(m.impressions || 0);
        stats.likes += Number(m.likes || 0);
        stats.comments += Number(m.comments || 0);
        stats.saves += Number(m.saves || 0);
        stats.shares += Number(m.shares || 0);
        stats.views += Number(m.views || 0);

        totals.reach += Number(m.reach || 0);
        totals.impressions += Number(m.impressions || 0);
        totals.likes += Number(m.likes || 0);
        totals.comments += Number(m.comments || 0);
        totals.saves += Number(m.saves || 0);
        totals.shares += Number(m.shares || 0);
        totals.views += Number(m.views || 0);
      });

      totals.deliverables += stats.deliverables;
      totals.campaigns.push(stats);
    });

    res.json({ success: true, data: totals });
  } catch (err) {
    console.error('❌ Error fetching dashboard insights:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.recommendInfluencers = async (req, res) => {
  try {
    const campaignDraft = req.body; // campaign form draft from frontend

    // Fetch influencers from DB
    const influencers = await Influencer.findAll({
      attributes: [
        "id",
        "full_name",
        "niche",
        "followers_count",
        "engagement_rate",
        "profile_image",
      ],
    });

    // Send to DeepSeek API
    const response = await axios.post(
      "https://api.deepseek.com/v1/chat/completions",
      {
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "You are an assistant that selects influencers. Return only a JSON array of influencer IDs that best fit the campaign draft.",
          },
          {
            role: "user",
            content: `Here is a campaign draft: ${JSON.stringify(
              campaignDraft
            )}. 
Here is a list of influencers: ${JSON.stringify(influencers)}. 
Return ONLY influencer IDs in JSON array format. Example: [1,5,7]`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const aiOutput = response.data.choices[0].message.content.trim();
    let recommendedIds = [];
    try {
      recommendedIds = JSON.parse(aiOutput);
    } catch (e) {
      console.warn("⚠️ AI output not JSON:", aiOutput);
    }

    // Filter influencers from DB
    const recommended = influencers.filter((i) =>
      recommendedIds.includes(i.id)
    );

    res.json({ success: true, recommended });
  } catch (err) {
    console.error("❌ Recommend Influencers Error:", err.message);
    res
      .status(500)
      .json({ success: false, message: "AI recommendation failed" });
  }
};

// ✅ Set Campaign to Draft
exports.setCampaignToDraft = async (req, res) => {
  try {
    const brandId = req.user.id;
    const campaignId = req.params.id;

    const campaign = await Campaign.findOne({
      where: { id: campaignId, brand_id: brandId },
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    await campaign.update({
      status: "draft",
    });

    res.json({
      success: true,
      message: "Campaign set to draft successfully!",
      data: campaign,
    });
  } catch (err) {
    console.error("❌ Error setting campaign to draft:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Unpublish Campaign
exports.unpublishCampaign = async (req, res) => {
  try {
    const brandId = req.user.id;
    const campaignId = req.params.id;

    const campaign = await Campaign.findOne({
      where: { id: campaignId, brand_id: brandId },
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    await campaign.update({
      status: "unpublished",
    });

    res.json({
      success: true,
      message: "Campaign unpublished successfully!",
      data: campaign,
    });
  } catch (err) {
    console.error("❌ Error unpublishing campaign:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Delete Campaign
exports.deleteCampaign = async (req, res) => {
  try {
    const brandId = req.user.id;
    const campaignId = req.params.id;

    const campaign = await Campaign.findOne({
      where: { id: campaignId, brand_id: brandId },
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    // Optionally delete associated applications
    await CampaignApplication.destroy({
      where: { campaign_id: campaignId },
    });

    await campaign.destroy();

    res.json({
      success: true,
      message: "Campaign deleted successfully!",
    });
  } catch (err) {
    console.error("❌ Error deleting campaign:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ✅ Publish Campaign (from draft or unpublished)
exports.publishCampaign = async (req, res) => {
  try {
    const brandId = req.user.id;
    const campaignId = req.params.id;

    const campaign = await Campaign.findOne({
      where: { id: campaignId, brand_id: brandId },
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    // Only allow publishing if in draft or unpublished
    if (campaign.status !== "draft" && campaign.status !== "unpublished") {
      return res.status(400).json({ success: false, message: "Campaign can only be published from draft or unpublished state" });
    }

    await campaign.update({
      status: "published",
    });

    res.json({
      success: true,
      message: "Campaign published successfully!",
      data: campaign,
    });
  } catch (err) {
    console.error("❌ Error publishing campaign:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /brand/campaigns/:id/influencers
exports.listCampaignInfluencersSimple = async (req, res) => {
  try {
    const brandId = req.user.id;
    const campaignId = req.params.id;

    // Ensure the campaign belongs to this brand
    const campaign = await db.Campaign.findOne({
      where: { id: campaignId, brand_id: brandId },
      attributes: ['id', 'title', 'status']
    });
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const apps = await db.CampaignApplication.findAll({
      where: { campaign_id: campaignId },
      attributes: ['id', 'status', 'created_at'],
      include: [{
        model: db.Influencer,
        attributes: ['id', 'full_name', 'profile_image', 'niche', 'followers_count', 'engagement_rate', 'availability']
      }],
      order: [['created_at', 'DESC']]
    });

    return res.json({ success: true, data: { campaign, applications: apps } });
  } catch (err) {
    console.error('❌ listCampaignInfluencersSimple error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /brand/campaigns/:id/influencers/:influencerId
// Creates (or ignores if exists) a forwarded application for admin/brand review flow
exports.addInfluencerToCampaign = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const brandId = req.user.id;
    const campaignId = req.params.id;
    const influencerId = Number(req.params.influencerId);

    // Validate campaign ownership
    const campaign = await db.Campaign.findOne({
      where: { id: campaignId, brand_id: brandId },
      transaction: t
    });
    if (!campaign) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    // Validate influencer exists
    const influencer = await db.Influencer.findByPk(influencerId, { transaction: t });
    if (!influencer) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Influencer not found' });
    }

    // Upsert-like behavior: avoid duplicates
    const [app, created] = await db.CampaignApplication.findOrCreate({
      where: { campaign_id: campaignId, influencer_id: influencerId },
      defaults: {
        campaign_id: campaignId,
        influencer_id: influencerId,
        status: 'forwarded',           // 👈 brand-added = forwarded
        forwardedBy: 'brand'
      },
      transaction: t
    });

    // If it exists but was previously rejected, optionally re-forward
    if (!created && app.status === 'rejected') {
      app.status = 'forwarded';
      app.forwardedBy = 'brand';
      await app.save({ transaction: t });
    }

    await t.commit();
    return res.json({
      success: true,
      message: created ? 'Influencer added to campaign' : 'Influencer already attached to campaign',
      data: { application: app }
    });
  } catch (err) {
    await t.rollback();
    console.error('❌ addInfluencerToCampaign error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /brand/campaigns/:id/influencers
// Body: { influencer_ids: number[] }
exports.addInfluencersToCampaign = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const brandId = req.user.id;
    const campaignId = req.params.id;
    let { influencer_ids } = req.body;

    if (typeof influencer_ids === 'string') {
      try { influencer_ids = JSON.parse(influencer_ids); } catch (_e) {}
    }
    if (!Array.isArray(influencer_ids) || influencer_ids.length === 0) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'influencer_ids must be a non-empty array' });
    }

    // Ensure campaign belongs to brand
    const campaign = await db.Campaign.findOne({
      where: { id: campaignId, brand_id: brandId },
      transaction: t
    });
    if (!campaign) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    // Validate influencers exist
    const influencers = await db.Influencer.findAll({
      where: { id: { [Op.in]: influencer_ids } },
      attributes: ['id'],
      transaction: t
    });
    const validIds = new Set(influencers.map(i => i.id));
    const toAttach = influencer_ids.filter(id => validIds.has(Number(id)));

    if (toAttach.length === 0) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'No valid influencer IDs provided' });
    }

    // Find existing links to avoid duplicates
    const existing = await db.CampaignApplication.findAll({
      where: {
        campaign_id: campaignId,
        influencer_id: { [Op.in]: toAttach }
      },
      attributes: ['influencer_id', 'status'],
      transaction: t
    });
    const existingSet = new Set(existing.map(e => Number(e.influencer_id)));

    // Prepare new rows for only non-existing pairs
    const inserts = toAttach
      .filter(id => !existingSet.has(Number(id)))
      .map(id => ({
        campaign_id: campaignId,
        influencer_id: id,
        status: 'forwarded',        // 👈 brand-added = forwarded
        forwardedBy: 'brand'
      }));

    if (inserts.length > 0) {
      await db.CampaignApplication.bulkCreate(inserts, { transaction: t });
    }

    // Optionally, re-forward any previously rejected in this batch
    const rejectedToReforward = existing.filter(e => e.status === 'rejected').map(e => e.influencer_id);
    if (rejectedToReforward.length > 0) {
      await db.CampaignApplication.update(
        { status: 'forwarded', forwardedBy: 'brand' },
        { where: { campaign_id: campaignId, influencer_id: { [Op.in]: rejectedToReforward } }, transaction: t }
      );
    }

    await t.commit();

    return res.json({
      success: true,
      message: 'Influencers processed',
      data: {
        requested: influencer_ids.length,
        attached: inserts.length,
        skipped_existing: existingSet.size,
        reforwarded: rejectedToReforward.length
      }
    });
  } catch (err) {
    await t.rollback();
    console.error('❌ addInfluencersToCampaign error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};