const db = require('../models');
const Campaign = db.Campaign;
const CampaignApplication = db.CampaignApplication;
const Influencer = db.Influencer;
const InfluencerInstagramAccount = db.InfluencerInstagramAccount;
const CampaignDeliverable = db.CampaignDeliverable;


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

}

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
}

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
}

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
}


exports.profile = async (req, res) => {
  try {
    const brand = await db.Brand.findByPk(req.user.id, {
      attributes: [
        'company_name',
        'contact_person',
        'email',
        'phone',
        'skype',
        'industry',
        'website',
        'profile_image'
      ]
    });

    if (!brand) return res.status(404).json({ message: 'Brand not found' });

    res.json({ message: 'Brand profile fetched', data: brand });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /brand/me
exports.getMyProfile = async (req, res) => {
  try {
    const influencer = await db.Brand.findByPk(req.user.id, {
      attributes: {
        exclude: ['password_hash']
      }
    });

    if (!influencer) {
      return res.status(404).json({ message: 'Influencer not found.' });
    }

    res.status(200).json(influencer);
  } catch (err) {
    res.status(500).json({ message: err.message });
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
}



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
      influencer_ids, // optional array
    } = req.body;

    const feature_image = req.file
      ? `/uploads/brands/${req.file.filename}`
      : null;

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
          status: "brand_approved", // ✅ forwarded by brand
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

    let feature_image = campaign.feature_image;
    if (req.file) {
      feature_image = `/uploads/brands/${req.file.filename}`;
    }

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
          where: { campaign_id: campaign.id, status: "brand_approved" },
        });

        // Insert new forwarded applications
        const apps = ids.map((iid) => ({
          influencer_id: iid,
          campaign_id: campaign.id,
          status: "forwarded",
          forwardedBy: "brand",
        }));
        await CampaignApplication.bulkCreate(apps);
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
    const brandId = req.user.id;

    // Get brand campaigns
    const campaigns = await Campaign.findAll({
      where: { brand_id: brandId },
      attributes: ['id', 'title', 'status']
    });
    const campaignIds = campaigns.map(c => c.id);

    if (campaignIds.length === 0) {
      return res.json({ message: 'No campaigns found for this brand', campaigns: [] });
    }

    // Get approved applications + influencers
    const approvedApps = await CampaignApplication.findAll({
      where: { campaign_id: campaignIds, status: 'approved' },
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
                exclude: ['username', 'email', 'access_token'] // 🚫 sensitive
              }
            }
          ]
        }
      ]
    });

    // Group influencers under campaigns
    const grouped = {};
    campaigns.forEach(c => {
      grouped[c.id] = { id: c.id, title: c.title, status: c.status, influencers: [] };
    });

    approvedApps.forEach(app => {
      if (grouped[app.Campaign.id]) {
        grouped[app.Campaign.id].influencers.push(app.Influencer);
      }
    });

    res.json({
      message: 'Approved influencers grouped by campaign',
      campaigns: Object.values(grouped)
    });
  } catch (err) {
    console.error('❌ Error fetching approved influencers:', err);
    res.status(500).json({ message: 'Internal server error', error: err.message });
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
    const brandId = req.user.id;

    const apps = await db.CampaignApplication.findAll({
      where: { status: 'forwarded' },
      include: [
        {
          model: db.Campaign,
          where: { brand_id: brandId },
          attributes: ['id', 'title', 'status']
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
                exclude: ['username', 'email', 'access_token'] // 🚫 sensitive
              }
            }
          ]
        }
      ],
    });

    res.json({ success: true, data: apps });
  } catch (err) {
    res.status(500).json({ message: err.message });
    console.log();
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
