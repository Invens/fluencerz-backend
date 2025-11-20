const db = require('../models');
const axios = require("axios");
const fs = require('fs'); // Added for directory creation
const path = require('path'); // Added for path handling
const Campaign = db.Campaign;
const CampaignApplication = db.CampaignApplication;
const Influencer = db.Influencer;
const InfluencerInstagramAccount = db.InfluencerInstagramAccount;
const CampaignDeliverable = db.CampaignDeliverable;
const { Op, fn, col } = db.Sequelize;
const { getActor } = require('./_authUtils');


// Ensure upload directory exists
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'brands');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log('📁 Created upload directory:', UPLOAD_DIR);
}


const COUNTRY_VARIANTS = {
  Germany: ["Germany", "germany", "de", "deutschland"],
  Switzerland: ["Switzerland", "switzerland", "ch"],
  Austria: ["Austria", "austria", "at", "österreich", "osterreich"],
  "United Kingdom": [
    "United Kingdom",
    "united kingdom",
    "united kingdo",
    "uk",
    "u.k.",
    "england",
    "great britain",
    "gb",
  ],
  "United States": [
    "United States",
    "united states",
    "united state",
    "usa",
    "u.s.a.",
    "us",
    "u.s.",
    "united states of america",
  ],
  "United Arab Emirates": [
    "United Arab Emirates",
    "united arab emirates",
    "uae",
    "u.a.e.",
    "dubai",
    "abu dhabi",
    "abudhabi",
    "sharjah",
    "ajman",
    "ras al khaimah",
    "fujairah",
    "umm al quwain",
  ],
};


// Flat list of all "non-India" country variants (used for India filter)
const GLOBAL_NOT_INDIA_VALUES = Object.values(COUNTRY_VARIANTS).flat();

const parseStructuredField = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
};

const parseBudgetValue = (value) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/[^0-9.]/g, "");
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const MAX_AI_INFLUENCER_CANDIDATES = 150;
const DEFAULT_RECOMMENDATION_COUNT = 10;
const PLATFORM_MAP = {
  instagram: "Instagram",
  youtube: "YouTube",
  twitter: "Twitter",
  telegram: "Telegram",
  other: "Other",
};
const CONTENT_TYPE_OPTIONS = [
  { keyword: "paid", value: "Paid per post" },
  { keyword: "reel", value: "Reel" },
  { keyword: "story", value: "Story" },
  { keyword: "post", value: "Post" },
  { keyword: "video", value: "Video" },
];

const normalizeEnumString = (value, optionsMap, fallback = "Other") => {
  if (!value) return fallback;
  const str = String(value).trim();
  if (!str) return fallback;
  const lower = str.toLowerCase();
  return optionsMap[lower] || fallback;
};

const normalizePlatformValue = (value) => {
  if (Array.isArray(value)) {
    return normalizeEnumString(value[0], PLATFORM_MAP);
  }
  return normalizeEnumString(value, PLATFORM_MAP);
};

const normalizeContentTypeValue = (value) => {
  const scanValues = Array.isArray(value) ? value : [value];
  for (const item of scanValues) {
    if (!item) continue;
    const lowerItem = String(item).toLowerCase();
    for (const option of CONTENT_TYPE_OPTIONS) {
      if (lowerItem.includes(option.keyword)) {
        return option.value;
      }
    }
  }
  return "Other";
};

/**
 * Normalize raw DB country value into:
 *  - "Germany" | "Switzerland" | "Austria" | "United Kingdom" | "United States"
 *  - OR "India" for everything else
 */
function normalizeCountry(raw) {
  if (!raw) return "India";
  let v = String(raw).trim();
  if (!v) return "India";

  // If we have something like "Delhi, India" or "Mumbai, Maharashtra, India"
  if (v.includes(",")) {
    const parts = v
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length) {
      // last part is usually the country
      v = parts[parts.length - 1];
    }
  }

  const lower = v.toLowerCase();

  // Check if it matches any known global country variants
  for (const [label, variants] of Object.entries(COUNTRY_VARIANTS)) {
    if (variants.some((vv) => vv.toLowerCase() === lower)) {
      return label; // e.g. "Germany"
    }
  }

  // Everything else (states, cities, unknowns) => India
  return "India";
}

/**
 * GET /api/brand/applications
 * Query params:
 *  - status: comma-separated statuses (e.g. pending,forwarded,brand_forwarded,brand_approved,approved,rejected)
 *  - campaign_id: number (optional)
 *  - limit: number (default 50, max 200)
 *  - offset: number (default 0)
 *
 * Returns applications grouped by status for the current brand.
 */
exports.getAllApplications = async (req, res) => {
  try {
    const brandId = req.user?.brand_id ?? req.user?.id;

    // ---- parse query params
    const ALL_STATUSES = ['pending', 'forwarded', 'brand_forwarded', 'brand_approved', 'approved', 'rejected'];
    const statusParam = (req.query.status || '').trim();
    const statuses = statusParam
      ? statusParam.split(',').map(s => s.trim()).filter(Boolean)
      : ALL_STATUSES;

    // validate statuses
    const invalid = statuses.filter(s => !ALL_STATUSES.includes(s));
    if (invalid.length) {
      return res.status(400).json({ message: `Invalid status values: ${invalid.join(', ')}` });
    }

    const campaignFilterId = req.query.campaign_id ? Number(req.query.campaign_id) : null;

    const limit  = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    // ---- find campaigns owned by brand (and optionally filter by one campaign)
    const campaignWhere = { brand_id: brandId };
    if (campaignFilterId) campaignWhere.id = campaignFilterId;

    const campaigns = await db.Campaign.findAll({
      where: campaignWhere,
      attributes: ['id', 'title', 'status'],
    });

    const campaignIds = campaigns.map(c => c.id);
    if (campaignIds.length === 0) {
      return res.json({
        success: true,
        totals: { all: 0, pending: 0, forwarded: 0, brand_forwarded: 0, brand_approved: 0, approved: 0, rejected: 0 },
        data: { pending: [], forwarded: [], brand_forwarded: [], brand_approved: [], approved: [], rejected: [] }
      });
    }

    // ---- build where for applications
    const appWhere = {
      campaign_id: { [Op.in]: campaignIds },
      status: { [Op.in]: statuses }
    };

    // ---- robust order by (applied_at exists in your model)
    const orderClause = [['applied_at', 'DESC']]; // if you ever rename/mapped, switch to createdAt

    // ---- run query
    const apps = await db.CampaignApplication.findAll({
      where: appWhere,
      include: [
        {
          model: db.Campaign,
          where: { id: { [Op.in]: campaignIds } }, // ensures ownership
          attributes: ['id', 'title', 'status', 'description'],
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
              attributes: { exclude: ['username', 'email', 'access_token', 'refresh_token'] }
            }
          ]
        }
      ],
      order: orderClause,
      limit,
      offset
    });

    // ---- group by status + compute totals
    const grouped = {
      pending: [],
      forwarded: [],
      brand_forwarded: [],
      brand_approved: [],
      approved: [],
      rejected: []
    };

    for (const a of apps) {
      if (grouped[a.status]) grouped[a.status].push(a);
    }

    const totals = {
      pending: grouped.pending.length,
      forwarded: grouped.forwarded.length,
      brand_forwarded: grouped.brand_forwarded.length,
      brand_approved: grouped.brand_approved.length,
      approved: grouped.approved.length,
      rejected: grouped.rejected.length,
      all: apps.length
    };

    return res.json({
      success: true,
      totals,
      pagination: { limit, offset, returned: apps.length },
      data: grouped
    });
  } catch (err) {
    console.error('[getAllApplications] error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
  }
};
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
    const page  = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
    const offset = (page - 1) * limit;

    const where = {};

    // search by name / email
    if (req.query.search) {
      const q = req.query.search.trim();
      if (q) {
        where[Op.or] = [
          { full_name: { [Op.like]: `%${q}%` } },
          { email: { [Op.like]: `%${q}%` } },
        ];
      }
    }

    // niche exact match
    if (req.query.niche) {
      where.niche = req.query.niche.trim();
    }

    // country filter with special rule:
    // - Germany / Switzerland / Austria / United Kingdom / United States = their own clusters
    // - Everything else = India
    if (req.query.country) {
      const requested = req.query.country.trim();
      const normalized = normalizeCountry(requested); // Germany, Switzerland, Austria, United Kingdom, United States, India

      if (!where[Op.and]) where[Op.and] = [];

      if (normalized === "India") {
        // India means: NOT any of the known global variants, OR country null/empty
        where[Op.and].push({
          [Op.or]: [
            { country: { [Op.notIn]: GLOBAL_NOT_INDIA_VALUES } },
            { country: null },
            { country: "" },
          ],
        });
      } else if (COUNTRY_VARIANTS[normalized]) {
        // Global countries: match any of their variants
        where[Op.and].push({
          country: {
            [Op.in]: COUNTRY_VARIANTS[normalized],
          },
        });
      } else {
        // Fallback: exact match
        where[Op.and].push({ country: requested });
      }
    }

    // availability = available | unavailable
    if (req.query.availability) {
      const allowed = ['available', 'unavailable'];
      const value = req.query.availability.trim().toLowerCase();
      if (allowed.includes(value)) {
        where.availability = value;
      }
    }

    // onboarded filter
    if (req.query.is_onboarded === 'true') {
      where.is_onboarded = true;
    } else if (req.query.is_onboarded === 'false') {
      where.is_onboarded = false;
    }

    // followers range
    if (req.query.min_followers || req.query.max_followers) {
      where.followers_count = {};
      if (req.query.min_followers) {
        where.followers_count[Op.gte] = parseInt(req.query.min_followers, 10) || 0;
      }
      if (req.query.max_followers) {
        where.followers_count[Op.lte] = parseInt(req.query.max_followers, 10) || 0;
      }
    }

    // engagement rate range (in %)
    if (req.query.min_engagement || req.query.max_engagement) {
      where.engagement_rate = {};
      if (req.query.min_engagement) {
        where.engagement_rate[Op.gte] = parseFloat(req.query.min_engagement);
      }
      if (req.query.max_engagement) {
        where.engagement_rate[Op.lte] = parseFloat(req.query.max_engagement);
      }
    }

    const sortableFields = ['id', 'followers_count', 'engagement_rate', 'created_at'];
    let sortBy = 'id';
    let sortDir = 'DESC';

    if (req.query.sort_by && sortableFields.includes(req.query.sort_by)) {
      sortBy = req.query.sort_by;
    }

    if (req.query.sort_dir && ['ASC', 'DESC'].includes(req.query.sort_dir.toUpperCase())) {
      sortDir = req.query.sort_dir.toUpperCase();
    }

    const { count, rows } = await db.Influencer.findAndCountAll({
      where,
      attributes: [
        'id',
        'auth_user_id',
        'full_name',
        'email',
        'phone',
        'skype',
        'profile_image',
        'profile_picture',
        'niche',
        'followers_count',
        'engagement_rate',
        'total_reach',
        'social_platforms',
        'followers_by_country',
        'audience_age_group',
        'audience_gender',
        'country',
        'categories',
        'communication_channel',
        'portfolio',
        'availability',
        'is_onboarded',
        'refluenced_raw_data',
        'instagram_posts',
        'performance_metrics',
        'audience_analytics',
        'original_uuid',
        'created_at',
        'updated_at',
      ],
      include: [
        {
          model: db.InfluencerInstagramAccount,
          as: 'instagramAccount',
          required: false,
          attributes: {
            exclude: ['access_token', 'token_expires_at', 'created_at', 'updated_at']
          }
        }
      ],
      limit,
      offset,
      order: [[sortBy, sortDir]],
    });

    const totalPages = Math.ceil(count / limit);

    const influencers = rows.map((row) => {
      const inf = row.toJSON();

      const socialPlatforms = Array.isArray(inf.social_platforms) ? inf.social_platforms : [];
      const followersByCountry = Array.isArray(inf.followers_by_country) ? inf.followers_by_country : [];
      const categories = Array.isArray(inf.categories) ? inf.categories : [];
      const instagramPosts = Array.isArray(inf.instagram_posts) ? inf.instagram_posts : [];
      const instagramAccountData = inf.instagramAccount || null;

      const totalSocialFollowers = socialPlatforms.reduce(
        (sum, p) => sum + (parseInt(p.followers, 10) || 0),
        0
      );

      return {
        id: inf.id,
        auth_user_id: inf.auth_user_id,

        // Basic profile
        profile: {
          full_name: inf.full_name,
          email: inf.email,
          phone: inf.phone,
          skype: inf.skype,
          country: inf.country,
          profile_image: inf.profile_image || inf.profile_picture || null,
          categories,
          portfolio: inf.portfolio,
          availability: inf.availability,
          is_onboarded: inf.is_onboarded,
        },

        // Niche & metrics
        metrics: {
          niche: inf.niche,
          followers_count: inf.followers_count,
          engagement_rate: inf.engagement_rate,
          total_reach: inf.total_reach,
          total_social_followers: totalSocialFollowers,
          performance_metrics: inf.performance_metrics || {},
        },

        // Audience data
        audience: {
          age_group: inf.audience_age_group,
          gender_split: inf.audience_gender || { male: 0, female: 0, other: 0 },
          followers_by_country: followersByCountry,
          analytics: inf.audience_analytics || {},
        },

        // Social & communication
        socials: {
          social_platforms: socialPlatforms,
          communication_channel: inf.communication_channel || {},
          instagram_posts: instagramPosts,
          instagram_account: instagramAccountData,
        },

        // Raw import / meta
        import_meta: {
          original_uuid: inf.original_uuid,
          refluenced_raw_data: inf.refluenced_raw_data || {},
        },

        created_at: inf.created_at,
        updated_at: inf.updated_at,
      };
    });

    return res.json({
      influencers,
      pagination: {
        currentPage: page,
        perPage: limit,
        totalPages,
        totalInfluencers: count,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      appliedFilters: {
        search: req.query.search || null,
        niche: req.query.niche || null,
        country: req.query.country || null,
        availability: req.query.availability || null,
        is_onboarded: req.query.is_onboarded ?? null,
        min_followers: req.query.min_followers || null,
        max_followers: req.query.max_followers || null,
        min_engagement: req.query.min_engagement || null,
        max_engagement: req.query.max_engagement || null,
        sort_by: sortBy,
        sort_dir: sortDir,
      },
    });
  } catch (err) {
    console.error('Error fetching influencers:', err);
    return res.status(500).json({ message: err.message || 'Failed to fetch influencers' });
  }
};

exports.influencerFilterMeta = async (req, res) => {
  try {
    // DISTINCT niche
    const nicheRows = await db.Influencer.findAll({
      attributes: [[fn("DISTINCT", col("niche")), "niche"]],
      where: {
        niche: { [Op.ne]: null },
      },
      raw: true,
    });

    const niches = nicheRows
      .map((r) => r.niche)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    // DISTINCT country (normalized into our 6 buckets)
    const countryRows = await db.Influencer.findAll({
      attributes: [[fn("DISTINCT", col("country")), "country"]],
      where: {
        country: { [Op.ne]: null },
      },
      raw: true,
    });

    const countrySet = new Set();

    countryRows.forEach((r) => {
      const norm = normalizeCountry(r.country);
      if (norm) countrySet.add(norm);
    });

    if (countrySet.size === 0) {
      countrySet.add("India");
    }

    const countries = Array.from(countrySet).sort((a, b) =>
      a.localeCompare(b)
    );

    return res.json({
      niches,
      countries,
    });
  } catch (err) {
    console.error("Error fetching influencer filter meta:", err);
    res.status(500).json({ message: err.message || "Failed to fetch meta" });
  }
};

exports.campaign = async (req, res) => {
  try {
    const brandId = req.user.id;

    const campaigns = await db.Campaign.findAll({
      where: { brand_id: brandId },
      include: [
        {
          model: db.CampaignApplication,
          // Remove the 'as' or use the correct alias from your model definition
          required: false,
          include: [
            {
              model: db.Influencer,
              attributes: ['id', 'full_name', 'email', 'profile_image']
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Transform the data to include influencer counts by status
    const transformedCampaigns = campaigns.map(campaign => {
      const campaignData = campaign.toJSON();
      
      // Initialize status counters
      const statusCounts = {
        approved: 0,
        pending: 0,
        forwarded: 0,
        brand_forwarded: 0,
        brand_approved: 0,
        rejected: 0,
        total: 0
      };

      // Count influencers by status
      // Use the correct property name for applications (check your model association)
      const applications = campaignData.CampaignApplications || campaignData.applications || [];
      
      applications.forEach(app => {
        if (app.status && statusCounts.hasOwnProperty(app.status)) {
          statusCounts[app.status]++;
          statusCounts.total++;
        }
      });

      // Get influencers grouped by status for detailed view
      const influencersByStatus = {
        approved: [],
        pending: [],
        forwarded: [],
        brand_forwarded: [],
        brand_approved: [],
        rejected: []
      };

      applications.forEach(app => {
        if (app.Influencer && app.status && influencersByStatus[app.status]) {
          influencersByStatus[app.status].push({
            id: app.Influencer.id,
            full_name: app.Influencer.full_name,
            email: app.Influencer.email,
            profile_image: app.Influencer.profile_image,
            application_id: app.id,
            application_status: app.status,
            applied_at: app.created_at
          });
        }
      });

      return {
        id: campaignData.id,
        brand_id: campaignData.brand_id,
        title: campaignData.title,
        description: campaignData.description,
        brief_link: campaignData.brief_link,
        media_kit_link: campaignData.media_kit_link,
        platform: campaignData.platform,
        budget: campaignData.budget,
        content_type: campaignData.content_type,
        eligibility_criteria: campaignData.eligibility_criteria,
        campaign_requirements: campaignData.campaign_requirements,
        guidelines_do: campaignData.guidelines_do,
        guidelines_donot: campaignData.guidelines_donot,
        feature_image: campaignData.feature_image,
        status: campaignData.status,
        start_date: campaignData.start_date,
        end_date: campaignData.end_date,
        created_at: campaignData.created_at,
        updated_at: campaignData.updated_at,
        
        // Influencer statistics
        influencer_stats: statusCounts,
        
        // Detailed influencer data grouped by status
        influencers: influencersByStatus,
        
        // Applications count
        total_applications: statusCounts.total
      };
    });

    res.json({ 
      success: true,
      message: 'Your campaigns with influencer statistics',
      data: transformedCampaigns 
    });
  } catch (err) {
    console.error('❌ Error fetching campaigns with influencer stats:', err);
    res.status(500).json({ 
      success: false,
      message: err.message 
    });
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
exports.getMyCampaigns = async (req, res) => {
  try {
    const brandId = req.user.id;

    const campaigns = await db.Campaign.findAll({
      where: { brand_id: brandId },
      include: [
        {
          model: db.CampaignApplication,
          as: 'applications',
          required: false,
          include: [
            {
              model: db.Influencer,
              as: 'influencer',
              attributes: [
                'id', 
                'full_name', 
                'profile_image', 
                'niche', 
                'followers_count',
                'engagement_rate',
                'country',
                'social_platforms'
              ]
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']],
    });

    // Transform the data to include influencers grouped by status
    const transformedCampaigns = campaigns.map(campaign => {
      const campaignData = campaign.toJSON();
      
      // Initialize status buckets
      const influencersByStatus = {
        approved: [],
        pending: [],
        forwarded: [],
        brand_forwarded: [],
        brand_approved: [],
        rejected: []
      };

      // Sort influencers into their respective status buckets
      campaignData.applications?.forEach(app => {
        if (app.influencer) { // Only include if influencer exists
          const influencerWithApp = {
            ...app.influencer,
            application_id: app.id,
            application_status: app.status,
            applied_at: app.created_at,
            forwarded_by: app.forwardedBy
          };

          if (influencersByStatus[app.status]) {
            influencersByStatus[app.status].push(influencerWithApp);
          }
        }
      });

      // Calculate totals for each status
      const statusCounts = {
        approved: influencersByStatus.approved.length,
        pending: influencersByStatus.pending.length,
        forwarded: influencersByStatus.forwarded.length,
        brand_forwarded: influencersByStatus.brand_forwarded.length,
        brand_approved: influencersByStatus.brand_approved.length,
        rejected: influencersByStatus.rejected.length,
        total: campaignData.applications?.length || 0
      };

      return {
        id: campaignData.id,
        brand_id: campaignData.brand_id,
        title: campaignData.title,
        description: campaignData.description,
        brief_link: campaignData.brief_link,
        media_kit_link: campaignData.media_kit_link,
        platform: campaignData.platform,
        budget: campaignData.budget,
        content_type: campaignData.content_type,
        eligibility_criteria: campaignData.eligibility_criteria,
        campaign_requirements: campaignData.campaign_requirements,
        guidelines_do: campaignData.guidelines_do,
        guidelines_donot: campaignData.guidelines_donot,
        feature_image: campaignData.feature_image,
        status: campaignData.status,
        created_at: campaignData.created_at,
        updated_at: campaignData.updated_at,
        influencer_counts: statusCounts,
        influencers: influencersByStatus
      };
    });

    res.json({ success: true, data: transformedCampaigns });
  } catch (err) {
    console.error('❌ Error fetching campaigns:', err);
    res.status(500).json({ success: false, message: err.message });
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
          status: "forwarded", // ✅ forwarded by brand
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

exports.createCampaignWithAI = async (req, res) => {
  try {
    const brandId = req.user.id;
    const { idea, tone, target_audience, platform_preferences, product_details } = req.body;

    if (!idea || typeof idea !== "string" || !idea.trim()) {
      return res.status(400).json({
        success: false,
        message: "idea is required to generate a campaign",
      });
    }

    const contextLines = [
      tone ? `Preferred tone: ${tone}` : null,
      target_audience ? `Target audience: ${target_audience}` : null,
      platform_preferences ? `Platform preferences: ${platform_preferences}` : null,
      product_details ? `Product / offer details: ${product_details}` : null,
    ].filter(Boolean);

    const contextBlock = contextLines.length
      ? `\nAdditional context:\n- ${contextLines.join("\n- ")}`
      : "";

    const schemaInstruction = `
Return ONLY valid JSON (no markdown) following this schema:
{
  "title": "string",
  "description": "string",
  "platform": "string",
  "content_type": "string",
  "budget": 0,
  "brief_link": null,
  "media_kit_link": null,
  "eligibility_criteria": ["string"],
  "campaign_requirements": ["string"],
  "guidelines_do": ["string"],
  "guidelines_donot": ["string"]
}
Use short bullet-style strings inside the arrays.
    `.trim();

    const aiResponse = await axios.post(
      "https://api.deepseek.com/v1/chat/completions",
      {
        model: "deepseek-chat",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content:
              "You are a campaign strategist who crafts influencer campaign briefs. Always reply with JSON that matches the requested schema.",
          },
          {
            role: "user",
            content: `Brand campaign idea:\n${idea}${contextBlock}\n\n${schemaInstruction}`,
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

    const aiMessage = aiResponse?.data?.choices?.[0]?.message?.content?.trim();
    if (!aiMessage) {
      return res.status(502).json({
        success: false,
        message: "AI did not return any campaign data",
      });
    }

    const sanitizedAiMessage = aiMessage
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    let blueprint;
    try {
      blueprint = JSON.parse(sanitizedAiMessage);
    } catch (parseErr) {
      console.error("❌ AI campaign JSON parse error:", sanitizedAiMessage);
      return res.status(502).json({
        success: false,
        message: "AI response could not be parsed into JSON",
        ai_output: sanitizedAiMessage,
      });
    }

    const normalizedPlatform = normalizePlatformValue(blueprint.platform);
    const normalizedContentType = normalizeContentTypeValue(
      blueprint.content_type
    );

    const structuredBlueprint = {
      title: blueprint.title || "AI Generated Campaign",
      description: blueprint.description || idea,
      platform: normalizedPlatform,
      content_type: normalizedContentType,
      brief_link: blueprint.brief_link ?? null,
      media_kit_link: blueprint.media_kit_link ?? null,
      eligibility_criteria: parseStructuredField(blueprint.eligibility_criteria),
      campaign_requirements: parseStructuredField(
        blueprint.campaign_requirements
      ),
      guidelines_do: parseStructuredField(blueprint.guidelines_do),
      guidelines_donot: parseStructuredField(blueprint.guidelines_donot),
      budget: parseBudgetValue(blueprint.budget),
    };

    return res.status(201).json({
      success: true,
      message: "AI campaign blueprint generated successfully",
      data: structuredBlueprint,
      ai_blueprint: blueprint,
    });
  } catch (err) {
    console.error("❌ Error generating campaign with AI:", err.response?.data || err);
    return res.status(500).json({
      success: false,
      message: "Failed to generate campaign with AI",
      error: err?.response?.data?.message || err.message,
    });
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
      where: { campaign_id: { [Op.in]: campaignIds }, status: 'approved' },
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
    const { decision } = req.body; // pending | approved | brand_approved | rejected

    const app = await db.CampaignApplication.findByPk(id, {
      include: [{ model: db.Campaign }],
    });

    if (!app || app.Campaign.brand_id !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Allow all status changes including pending
    const allowedDecisions = ['pending', 'approved', 'brand_approved', 'rejected'];
    
    if (!allowedDecisions.includes(decision)) {
      return res.status(400).json({ 
        message: 'Invalid decision. Use "pending", "approved", "brand_approved" or "rejected"',
        received: decision,
        allowed: allowedDecisions
      });
    }

    app.status = decision;
    await app.save();

    // Customize message based on the specific decision
    let message = '';
    if (decision === 'brand_approved') {
      message = 'Application brand approved';
    } else if (decision === 'approved') {
      message = 'Application approved';
    } else if (decision === 'rejected') {
      message = 'Application rejected';
    } else if (decision === 'pending') {
      message = 'Application status reset to pending';
    }

    res.json({
      success: true,
      message: message,
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
          attributes: ['id', 'title', 'status' ,'description']
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
              attributes: ["id", "full_name", "profile_image", "followers_count", "engagement_rate", "niche", "country", "social_platforms", "availability",],
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
  let influencerPool = [];

  const sendFallback = async (message) => {
    if (!influencerPool.length) {
      const fallbackRows = await Influencer.findAll({
        attributes: [
          "id",
          "full_name",
          "niche",
          "followers_count",
          "engagement_rate",
          "profile_image",
        ],
        order: [["followers_count", "DESC"]],
        limit: DEFAULT_RECOMMENDATION_COUNT,
      });
      influencerPool = fallbackRows.map((row) => row.toJSON());
    }

    const fallback = influencerPool
      .slice(0, DEFAULT_RECOMMENDATION_COUNT)
      .map((inf) => ({
        id: inf.id,
        full_name: inf.full_name,
        niche: inf.niche,
        followers_count: inf.followers_count,
        engagement_rate: inf.engagement_rate,
        profile_image: inf.profile_image,
      }));

    return res.status(200).json({
      success: true,
      source: "fallback",
      message,
      recommended: fallback,
    });
  };

  try {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return sendFallback("AI key missing; returning default influencers");
    }

    const campaignDraft = req.body || {};

    const influencerRows = await Influencer.findAll({
      attributes: [
        "id",
        "full_name",
        "niche",
        "followers_count",
        "engagement_rate",
        "profile_image",
      ],
      order: [["followers_count", "DESC"]],
      limit: MAX_AI_INFLUENCER_CANDIDATES,
    });

    influencerPool = influencerRows.map((row) => row.toJSON());

    if (!influencerPool.length) {
      return res.json({ success: true, recommended: [], source: "empty" });
    }

    const minimalPool = influencerPool.map((inf) => ({
      id: inf.id,
      name: inf.full_name,
      niche: inf.niche,
      followers_count: inf.followers_count,
      engagement_rate: inf.engagement_rate,
    }));

    const schemaInstruction =
      "Return ONLY a JSON array of influencer IDs (numbers) chosen from the provided list. Example: [1,5,7]";

    const response = await axios.post(
      "https://api.deepseek.com/v1/chat/completions",
      {
        model: "deepseek-chat",
        temperature: 0.5,
        messages: [
          {
            role: "system",
            content:
              "You recommend influencers for campaigns. Always respond with raw JSON as requested.",
          },
          {
            role: "user",
            content: `Campaign draft: ${JSON.stringify(
              campaignDraft
            )}\nInfluencer pool: ${JSON.stringify(
              minimalPool
            )}\n\n${schemaInstruction}`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const aiOutput =
      response?.data?.choices?.[0]?.message?.content?.trim() || "[]";
    const sanitized = aiOutput
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    let recommendedIds;
    try {
      recommendedIds = JSON.parse(sanitized);
    } catch (parseErr) {
      console.warn("⚠️ AI output not JSON:", sanitized);
      return sendFallback("AI response could not be parsed; showing defaults");
    }

    if (!Array.isArray(recommendedIds)) {
      return sendFallback("AI response invalid; showing defaults");
    }

    const normalizedIds = Array.from(
      new Set(
        recommendedIds
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0)
      )
    );

    if (!normalizedIds.length) {
      return sendFallback("AI response empty; showing defaults");
    }

    const recommended = influencerPool
      .filter((inf) => normalizedIds.includes(inf.id))
      .slice(0, DEFAULT_RECOMMENDATION_COUNT)
      .map((inf) => ({
        id: inf.id,
        full_name: inf.full_name,
        niche: inf.niche,
        followers_count: inf.followers_count,
        engagement_rate: inf.engagement_rate,
        profile_image: inf.profile_image,
      }));

    if (!recommended.length) {
      return sendFallback("AI picked influencers not in pool; showing defaults");
    }

    return res.json({
      success: true,
      source: "ai",
      recommended,
    });
  } catch (err) {
    console.error("❌ Recommend Influencers Error:", err.response?.data || err);
    return sendFallback("AI recommendation failed; showing defaults");
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

// Creates (or ignores if exists) a forwarded application for admin/brand review flow
// ✅ FIXED: Add influencer to campaign with pending status
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
        status: 'pending',           // ✅ FIXED: set to pending instead of approved
        forwardedBy: 'brand'
      },
      transaction: t
    });

    // If it exists but was previously rejected, optionally re-forward
    if (!created && app.status === 'rejected') {
      app.status = 'pending'; // ✅ FIXED: set to pending
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

// ✅ FIXED: Add multiple influencers to campaign with pending status
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
        status: 'pending',        // ✅ FIXED: set to pending instead of approved
        forwardedBy: 'brand'
      }));

    if (inserts.length > 0) {
      await db.CampaignApplication.bulkCreate(inserts, { transaction: t });
    }

    // Optionally, re-forward any previously rejected in this batch
    const rejectedToReforward = existing.filter(e => e.status === 'rejected').map(e => e.influencer_id);
    if (rejectedToReforward.length > 0) {
      await db.CampaignApplication.update(
        { status: 'pending', forwardedBy: 'brand' }, // ✅ FIXED: set to pending
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
