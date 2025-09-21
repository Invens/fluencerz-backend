const db = require('../models');
const axios = require("axios");
const { Sequelize } = require('sequelize');
const InfluencerInstagramAccount = db.InfluencerInstagramAccount;

/**
 * ======================
 * 📌 CAMPAIGN MANAGEMENT
 * ======================
 */

// Admin creates a campaign for any brand
exports.createCampaign = async (req, res) => {
  try {
    const {
      brand_id,
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
      status = 'published'
    } = req.body;

    const feature_image = req.file ? `/uploads/brand/${req.file.filename}` : null;

    const brand = await db.Brand.findByPk(brand_id);
    if (!brand) return res.status(404).json({ message: 'Brand not found' });

    const campaign = await db.Campaign.create({
      brand_id,
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
      feature_image
    });

    res.status(201).json({ success: true, message: 'Campaign created by admin', data: campaign });
  } catch (err) {
    console.error('❌ Admin campaign creation error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
};

// List all campaigns (with brand)
exports.getAllCampaigns = async (req, res) => {
  try {
    const campaigns = await db.Campaign.findAll({
      include: [{ model: db.Brand, attributes: ['id', 'company_name', 'email', 'profile_picture'] }],
      order: [['created_at', 'DESC']]
    });
    res.status(200).json({ success: true, data: campaigns });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// One campaign with brand + applications + influencers
exports.getCampaignDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await db.Campaign.findByPk(id, {
      include: [
        { model: db.Brand, attributes: ['id', 'company_name', 'email', 'profile_picture'] },
        {
          model: db.CampaignApplication,
          include: [{ model: db.Influencer, attributes: ['id', 'full_name', 'profile_image'] }]
        }
      ]
    });
    if (!campaign) return res.status(404).json({ success: false, message: 'Campaign not found' });
    res.json({ success: true, data: campaign });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * ======================
 * 📌 COLLAB REQUESTS
 * ======================
 */

exports.getAllCollabRequests = async (req, res) => {
  try {
    const requests = await db.CollabRequest.findAll({
      include: [
        { model: db.Brand, attributes: ['id', 'company_name', 'email', 'profile_picture'] },
        { model: db.Influencer, attributes: ['id', 'full_name', 'email', 'profile_image'] }
      ],
      order: [['created_at', 'DESC']]
    });

    res.status(200).json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * ======================
 * 📌 BRANDS MANAGEMENT
 * ======================
 */


// ✅ Get single brand with details
exports.getBrandById = async (req, res) => {
  try {
    const { id } = req.params;

    const brand = await db.Brand.findByPk(id, {
      attributes: [
        "id",
        "company_name",
        "email",
        "profile_picture",
        "created_at",
        "updated_at"
      ],
      include: [
        {
          model: db.Campaign,
          attributes: [
            "id",
            "title",
            "description",
            "platform",
            "brief_link",
            "media_kit_link",
            "eligibility_criteria",
            "campaign_requirements",
            "guidelines_do",
            "guidelines_donot",
            "status",
            "content_type",
            "feature_image",
            "created_at"
          ],
          include: [
            {
              model: db.CampaignApplication,
              attributes: ["id", "status", "applied_at"],
              include: [
                {
                  model: db.Influencer,
                  attributes: ["id", "full_name", "profile_image"]
                }
              ]
            }
          ]
        }
      ]
    });

    if (!brand) {
      return res.status(404).json({ success: false, message: "Brand not found" });
    }

    res.json({ success: true, data: brand });
  } catch (err) {
    console.error("❌ getBrandById error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// All brands with counts
exports.getAllBrands = async (req, res) => {
  try {
    const brands = await db.Brand.findAll({
      attributes: [
        'id', 'company_name', 'email', 'profile_picture',
        [Sequelize.fn('COUNT', Sequelize.col('Campaigns.id')), 'campaign_count'],
        [Sequelize.fn('COUNT', Sequelize.col('Campaigns->CampaignApplications.id')), 'applications_count']
      ],
      include: [
        { model: db.Campaign, attributes: [], include: [{ model: db.CampaignApplication, attributes: [] }] }
      ],
      group: ['Brand.id'],
      order: [[Sequelize.literal('campaign_count'), 'DESC']]
    });

    res.json({ success: true, data: brands });
  } catch (err) {
    console.error('getAllBrands error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// Campaigns of one brand (with their applications and influencer heads)
exports.getBrandCampaigns = async (req, res) => {
  try {
    const { id } = req.params;
    const campaigns = await db.Campaign.findAll({
      where: { brand_id: id },
      include: [
        {
          model: db.CampaignApplication,
          attributes: ['id', 'status', 'applied_at'],
          include: [{ model: db.Influencer, attributes: ['id', 'full_name', 'profile_image'] }]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({ success: true, data: campaigns });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * ======================
 * 📌 INFLUENCERS MANAGEMENT
 * ======================
 */

async function fetchStories(userId, token) {
  try {
    const res = await safeRequest(
      `https://graph.instagram.com/${userId}/stories`,
      {
        params: {
          fields: "id,media_type,media_url,permalink,timestamp",
          access_token: token,
        },
      },
      "Stories List"
    );
    return res?.data || [];
  } catch {
    return [];
  }
}

// ---------- MEDIA HELPERS ----------
async function fetchAllMedia(token) {
  let allMedia = [];
  let url = `https://graph.instagram.com/me/media`;
  let params = {
    fields: "id,caption,media_type,media_url,permalink,timestamp,thumbnail_url",
    access_token: token,
    limit: 50,
  };

  while (url) {
    const res = await safeRequest(url, { params }, "Media List");
    if (res?.data) {
      allMedia = [...allMedia, ...res.data];
      url = res.paging?.next || null;
      params = {};
    } else url = null;
  }
  return allMedia;
}

// ---------- LOGGER ----------
function log(...args) {
  console.log("[LOG]", ...args);
}

// ---------- SAFE REQUEST ----------
async function safeRequest(url, options, label = "API REQUEST") {
  try {
    log(`➡️ [API REQUEST] ${label}`, { url, ...options });
    const res = await axios.get(url, options);
    log(`✅ [API SUCCESS] ${label}`, res.data);
    return res.data;
  } catch (err) {
    log(`❌ [API ERROR] ${label}`, err.response?.data || err.message);
    throw err.response?.data || err;
  }
}

// ---------- RETRY WRAPPER ----------
async function safeRequestWithRetry(url, options, label, maxRetries = 2) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      return await safeRequest(url, options, label);
    } catch (err) {
      attempt++;
      const code = err?.error?.code || err.code;
      if (![2, 4, 17].includes(code) || attempt > maxRetries) throw err;

      const delay = 1000 * Math.pow(2, attempt - 1);
      log(`⚠️ Retry ${attempt}/${maxRetries} for ${label} in ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// ---------- METRICS SELECTOR ----------
function getMetricsForType(mediaType) {
  switch (mediaType) {
    case "IMAGE":
    case "CAROUSEL_ALBUM":
      return "reach,likes,comments,saved,shares";
    case "VIDEO":
    case "REEL":
      return "reach,likes,comments,saved,shares,views";
    case "STORY":
      return "reach,replies,shares,profile_visits";
    default:
      return "reach,likes,comments";
  }
}

exports.refreshInstagramData = async (req, res) => {
  try {
    const { id } = req.params; // influencer id from route
    const requester = req.user; // from JWT (admin or influencer)

    // ✅ Only allow admin or the influencer themselves
    if (requester.userType !== "admin" && requester.id != id) {
      return res.status(403).json({ message: "Forbidden: You cannot refresh this influencer's data." });
    }

    const account = await InfluencerInstagramAccount.findOne({
      where: { influencer_id: id },
    });

    if (!account) {
      return res.status(404).json({ message: "Instagram not connected for this influencer" });
    }

    let accessToken = account.access_token;

    // 🔄 Refresh long-lived token if it's expiring in less than 7 days
    const expiresAt = new Date(account.token_expires_at);
    if ((expiresAt - new Date()) / (1000 * 60 * 60 * 24) < 7) {
      const refreshRes = await axios.get("https://graph.instagram.com/refresh_access_token", {
        params: {
          grant_type: "ig_refresh_token",
          access_token: accessToken,
        },
      });

      accessToken = refreshRes.data.access_token;
      account.access_token = accessToken;
      account.token_expires_at = new Date(Date.now() + refreshRes.data.expires_in * 1000);
    }

    // 🔁 Fetch Profile
    const profile = await safeRequest(
      `https://graph.instagram.com/v23.0/${account.ig_user_id}`,
      {
        params: {
          fields:
            "id,username,name,biography,profile_picture_url,website,followers_count,follows_count,media_count",
          access_token: accessToken,
        },
      },
      "Profile Refresh"
    );

    // 🔁 Fetch Media + Stories
    const media = await fetchAllMedia(accessToken);
    const stories = await fetchStories(account.ig_user_id, accessToken);
    const allContent = [...media, ...stories];

    // 🔁 Media Insights
    const mediaWithInsights = await Promise.all(
      allContent.map(async (m) => {
        try {
          const metrics = getMetricsForType(m.media_type);
          const insights = await safeRequest(
            `https://graph.instagram.com/v23.0/${m.id}/insights`,
            { params: { metric: metrics, access_token: accessToken } },
            `Media Insights ${m.id}`
          );
          return { ...m, insights };
        } catch (err) {
          return { ...m, insights: null, error: err.message };
        }
      })
    );

    // 🔁 Daily Insights
    const dayMetrics = ["accounts_engaged", "total_interactions", "reach", "impressions", "views"];
    const insightsDay = {};
    for (const metric of dayMetrics) {
      try {
        insightsDay[metric] = await safeRequestWithRetry(
          `https://graph.instagram.com/v23.0/${account.ig_user_id}/insights`,
          { params: { metric, period: "day", access_token: accessToken } },
          `Account Insights (day) - ${metric}`
        );
      } catch (err) {
        insightsDay[metric] = { error: err.message };
      }
    }

    // 🔁 30-Day Insights
    const insights30Days = {};
    const metrics30Config = [
      { name: "engaged_audience_demographics", params: { period: "lifetime", breakdown: "gender,country" } },
      { name: "follower_demographics", params: { period: "lifetime", breakdown: "gender,country" } },
    ];

    for (const metric of metrics30Config) {
      try {
        insights30Days[metric.name] = await safeRequestWithRetry(
          `https://graph.instagram.com/v23.0/${account.ig_user_id}/insights`,
          { params: { ...metric.params, metric: metric.name, access_token: accessToken } },
          `Account Insights (30 days) - ${metric.name}`
        );
      } catch (err) {
        insights30Days[metric.name] = { error: err.message };
      }
    }

    // 🔁 Aggregates
    const contentCount = mediaWithInsights.length;
    const totalLikes = mediaWithInsights.reduce((sum, m) => {
      return sum + (m.insights?.data?.find((i) => i.name === "likes")?.values?.[0]?.value || 0);
    }, 0);
    const totalComments = mediaWithInsights.reduce((sum, m) => {
      return sum + (m.insights?.data?.find((i) => i.name === "comments")?.values?.[0]?.value || 0);
    }, 0);
    const totalReach = mediaWithInsights.reduce((sum, m) => {
      return sum + (m.insights?.data?.find((i) => i.name === "reach")?.values?.[0]?.value || 0);
    }, 0);
    const totalViews = mediaWithInsights.reduce((sum, m) => {
      return sum + (m.insights?.data?.find((i) => i.name === "views")?.values?.[0]?.value || 0);
    }, 0);

    const avgLikes = contentCount ? totalLikes / contentCount : 0;
    const avgComments = contentCount ? totalComments / contentCount : 0;
    const avgReach = contentCount ? totalReach / contentCount : 0;
    const avgViews = contentCount ? totalViews / contentCount : 0;

    const engagementRate =
      profile.followers_count > 0 ? ((avgLikes + avgComments) / profile.followers_count) * 100 : 0;

    // 🔁 Save updates
    await account.update({
      username: profile.username,
      profile_picture_url: profile.profile_picture_url,
      biography: profile.biography,
      website: profile.website,
      followers_count: profile.followers_count,
      follows_count: profile.follows_count,
      media_count: profile.media_count,
      account_insights_day: insightsDay,
      account_insights_30days: insights30Days,
      media_with_insights: mediaWithInsights,
      avg_likes: avgLikes,
      avg_comments: avgComments,
      avg_reach: avgReach,
      avg_views: avgViews,
      total_engagements: engagementRate,
      access_token: accessToken,
    });

    res.json({
      success: true,
      message: "Instagram data refreshed & saved",
      data: account,
    });
  } catch (err) {
    console.error("❌ Failed to refresh IG data:", err);
    res.status(500).json({ error: "Failed to refresh IG data" });
  }
};

// List influencers with basic stats
exports.getAllInfluencers = async (req, res) => {
  try {
    const influencers = await db.Influencer.findAll({
      attributes: [
        'id', 'full_name', 'niche', 'followers_count', 'engagement_rate', 'profile_image',
        [Sequelize.fn('COUNT', Sequelize.col('CampaignApplications.id')), 'applications_count']
      ],
      include: [{ model: db.CampaignApplication, attributes: [] }],
      group: ['Influencer.id'],
      order: [['created_at', 'DESC']]
    });

    res.json({ success: true, data: influencers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Full influencer profile (exclude email/username/access_token by policy)
exports.getInfluencerProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const influencer = await db.Influencer.findByPk(id, {
      attributes: { exclude: ['email', 'password_hash'] },
      include: [
        {
          model: db.InfluencerInstagramAccount,
          as: 'instagramAccount',
          attributes: {
            exclude: ['username', 'access_token', 'token_expires_at', 'created_at', 'updated_at']
          }
        },
        {
          model: db.CampaignApplication,
          attributes: ['id', 'status', 'applied_at'],
          include: [{ model: db.Campaign, attributes: ['id', 'title'], include: [{ model: db.Brand, attributes: ['id', 'company_name'] }] }]
        }
      ]
    });

    if (!influencer) return res.status(404).json({ success: false, message: 'Influencer not found' });
    res.json({ success: true, data: influencer });
  } catch (err) {
    console.error('getInfluencerProfile error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * ======================
 * 📌 ADMIN INSIGHTS & STATS
 * ======================
 */

exports.getBrandInsights = async (req, res) => {
  try {
    const brands = await db.Brand.findAll({
      attributes: [
        'id',
        'company_name',
        'email',
        [db.Sequelize.fn('COUNT', db.Sequelize.col('Campaigns.id')), 'campaign_count'],
        [db.Sequelize.fn('COUNT', db.Sequelize.col('Campaigns->CampaignApplications.id')), 'applications_count']
      ],
      include: [{ model: db.Campaign, attributes: [], include: [{ model: db.CampaignApplication, attributes: [] }] }],
      group: ['Brand.id'],
      order: [[db.Sequelize.literal('campaign_count'), 'DESC']]
    });

    res.json({ success: true, data: brands });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getInfluencerInsights = async (req, res) => {
  try {
    const influencers = await db.Influencer.findAll({
      attributes: [
        'id',
        'full_name',
        'email',
        [db.Sequelize.literal(`(
            SELECT COUNT(*)
            FROM Campaigns AS c
            WHERE cr.influencer_id = Influencer.id
          )`), 'campaign_count'],
        [db.Sequelize.literal(`(
            SELECT AVG(r.rating_value)
            FROM ratings r
            JOIN Campaigns c ON c.id = r.campaign_id
            WHERE cr.influencer_id = Influencer.id
          )`), 'average_rating']
      ],
      order: [
        [db.Sequelize.literal('average_rating IS NULL'), 'ASC'],
        [db.Sequelize.literal('average_rating'), 'DESC']
      ]
    });

    res.json({ success: true, data: influencers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAdminStats = async (req, res) => {
  try {
    const [brands, influencers, collabs, campaigns] = await Promise.all([
      db.Brand.count(),
      db.Influencer.count(),
      db.CollabRequest.findAll({
        attributes: [
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'total'],
          [Sequelize.fn('SUM', Sequelize.literal("status = 'pending'")), 'pending'],
          [Sequelize.fn('SUM', Sequelize.literal("status = 'approved'")), 'approved'],
          [Sequelize.fn('SUM', Sequelize.literal("status = 'rejected'")), 'rejected']
        ],
        raw: true
      }),
      db.Campaign.findAll({
        attributes: [
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'total'],
          [Sequelize.fn('SUM', Sequelize.col('quotation_amount')), 'total_quotation']
        ],
        raw: true
      })
    ]);

    res.status(200).json({
      success: true,
      brands,
      influencers,
      collab_requests: {
        total: Number(collabs[0].total),
        pending: Number(collabs[0].pending),
        approved: Number(collabs[0].approved),
        rejected: Number(collabs[0].rejected)
      },
      campaigns: {
        total: Number(campaigns[0].total),
        total_quotation: Number(campaigns[0].total_quotation) || 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * ======================
 * 📌 APPLICATION MANAGEMENT
 * ======================
 */

// Admin fetch pending
exports.getPendingApplications = async (req, res) => {
  try {
    const applications = await db.CampaignApplication.findAll({
      where: { status: 'pending' },
      include: [
        { model: db.Influencer, attributes: ['id', 'full_name', 'profile_image'] },
        { model: db.Campaign, include: [{ model: db.Brand, attributes: ['id', 'company_name'] }] }
      ],
      order: [['applied_at', 'DESC']]
    });
    res.json({ success: true, data: applications });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin: forward | approve | reject (admin has final control)
exports.handleApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision } = req.body; // 'forwarded' | 'approved' | 'rejected'

    const app = await db.CampaignApplication.findByPk(id, {
      include: [db.Campaign, db.Influencer],
    });
    if (!app) return res.status(404).json({ success: false, message: 'Application not found' });

    if (!['forwarded', 'approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Invalid decision' });
    }

    app.status = decision;
    await app.save();

    res.json({
      success: true,
      message: `Application ${decision} by admin`,
      data: {
        id: app.id,
        status: app.status,
        influencer: app.Influencer?.full_name,
        campaign: app.Campaign?.title
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin fetch forwarded / approved / rejected
exports.getForwardedApplications = async (req, res) => {
  try {
    const apps = await db.CampaignApplication.findAll({
      where: { status: 'forwarded' },
      include: [
        { model: db.Influencer, attributes: ['id', 'full_name', 'profile_image'] },
        { model: db.Campaign, attributes: ['id', 'title'], include: [{ model: db.Brand, attributes: ['id', 'company_name'] }] }
      ],
      order: [['applied_at', 'DESC']]
    });
    res.json({ success: true, data: apps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getApprovedApplications = async (req, res) => {
  try {
    const apps = await db.CampaignApplication.findAll({
      where: { status: 'approved' },
      include: [
        { model: db.Influencer, attributes: ['id', 'full_name', 'profile_image'] },
        { model: db.Campaign, attributes: ['id', 'title'], include: [{ model: db.Brand, attributes: ['id', 'company_name'] }] }
      ],
      order: [['applied_at', 'DESC']]
    });
    res.json({ success: true, data: apps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getRejectedApplications = async (req, res) => {
  try {
    const apps = await db.CampaignApplication.findAll({
      where: { status: 'rejected' },
      include: [
        { model: db.Influencer, attributes: ['id', 'full_name', 'profile_image'] },
        { model: db.Campaign, attributes: ['id', 'title'], include: [{ model: db.Brand, attributes: ['id', 'company_name'] }] }
      ],
      order: [['applied_at', 'DESC']]
    });
    res.json({ success: true, data: apps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * ======================
 * 📌 MEDIA & MESSAGES MODERATION
 * ======================
 */

exports.getPendingMediaFiles = async (req, res) => {
  try {
    const media = await db.CampaignMediaFile.findAll({
      where: { is_approved: false },
      include: [{ model: db.Campaign, attributes: ['id', 'title'] }],
      order: [['uploaded_at', 'DESC']]
    });
    res.json({ success: true, data: media });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.approveMediaFile = async (req, res) => {
  try {
    const mediaFileId = req.params.id;
    const mediaFile = await db.CampaignMediaFile.findByPk(mediaFileId);
    if (!mediaFile) return res.status(404).json({ success: false, message: 'Media file not found' });

    mediaFile.is_approved = true;
    await mediaFile.save();

    res.json({ success: true, message: 'Media file approved', data: mediaFile });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getPendingMessages = async (req, res) => {
  try {
    const msgs = await db.CampaignMessage.findAll({
      where: { is_approved: false },
      include: [{ model: db.Campaign, attributes: ['id', 'title'] }],
      order: [['created_at', 'DESC']]
    });
    res.json({ success: true, data: msgs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.approveMessage = async (req, res) => {
  try {
    const messageId = req.params.id;
    const message = await db.CampaignMessage.findByPk(messageId);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

    message.is_approved = true;
    await message.save();

    res.json({ success: true, message: 'Message approved', data: message });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
