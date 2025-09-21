const axios = require("axios");
const db = require("../models");
const InfluencerInstagramAccount = db.InfluencerInstagramAccount;

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

// ---------- STEP 1: AUTH ----------
exports.authInstagram = (req, res) => {
  const influencerId = req.user?.id;
  if (!influencerId) {
    return res.status(401).json({ message: "Unauthorized. Login required." });
  }

  const authUrl =
    `https://www.instagram.com/oauth/authorize?force_reauth=true` +
    `&client_id=${process.env.INSTAGRAM_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=instagram_business_basic,instagram_business_manage_insights` +
    `&state=${influencerId}`;

  log("➡️ Redirecting to Instagram Login:", authUrl);
  res.json({ url: authUrl });
};

// ---------- STEP 2: CALLBACK ----------
exports.instagramCallback = async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.status(400).send("Missing authorization code or state");
  }

  const influencerId = state;
  try {
    // Short-lived token
    const tokenRes = await axios.post(
      "https://api.instagram.com/oauth/access_token",
      new URLSearchParams({
        client_id: process.env.INSTAGRAM_APP_ID,
        client_secret: process.env.INSTAGRAM_APP_SECRET,
        grant_type: "authorization_code",
        redirect_uri: process.env.REDIRECT_URI,
        code,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, user_id } = tokenRes.data;

    // Long-lived token
    const longLived = await safeRequest(
      "https://graph.instagram.com/access_token",
      {
        params: {
          grant_type: "ig_exchange_token",
          client_secret: process.env.INSTAGRAM_APP_SECRET,
          access_token,
        },
      },
      "Long-lived Token Exchange"
    );

    // Fetch basic profile
    const profile = await safeRequest(
      `https://graph.instagram.com/v23.0/${user_id}`,
      {
        params: {
          fields:
            "id,username,name,biography,profile_picture_url,website,followers_count,follows_count,media_count",
          access_token: longLived.access_token,
        },
      },
      "Profile Basic"
    );

    // ---------- FETCH MEDIA + INSIGHTS ----------
    const media = await fetchAllMedia(longLived.access_token);
    const stories = await fetchStories(user_id, longLived.access_token);
    const allContent = [...media, ...stories];

    const mediaWithInsights = await Promise.all(
      allContent.map(async (m) => {
        try {
          const metrics = getMetricsForType(m.media_type);
          const insights = await safeRequest(
            `https://graph.instagram.com/v23.0/${m.id}/insights`,
            { params: { metric: metrics, access_token: longLived.access_token } },
            `Media Insights ${m.id}`
          );
          return { ...m, insights };
        } catch (err) {
          return { ...m, insights: null, error: err.message };
        }
      })
    );

    // ---------- FETCH DAILY INSIGHTS ----------
    const dayMetrics = ["accounts_engaged", "total_interactions", "reach", "impressions", "views"];
    const insightsDay = {};
    for (const metric of dayMetrics) {
      try {
        insightsDay[metric] = await safeRequestWithRetry(
          `https://graph.instagram.com/v23.0/${user_id}/insights`,
          { params: { metric, period: "day", access_token: longLived.access_token } },
          `Account Insights (day) - ${metric}`
        );
      } catch (err) {
        insightsDay[metric] = { error: err.message };
      }
    }

    // ---------- FETCH 30-DAY INSIGHTS ----------
    const insights30Days = {};
    const metrics30Config = [
      { name: "engaged_audience_demographics", params: { period: "lifetime", breakdown: "gender,country" } },
      { name: "follower_demographics", params: { period: "lifetime", breakdown: "gender,country" } }
    ];

    for (const metric of metrics30Config) {
      try {
        insights30Days[metric.name] = await safeRequestWithRetry(
          `https://graph.instagram.com/v23.0/${user_id}/insights`,
          { params: { ...metric.params, metric: metric.name, access_token: longLived.access_token } },
          `Account Insights (30 days) - ${metric.name}`
        );
      } catch (err) {
        insights30Days[metric.name] = { error: err.message };
      }
    }

    // ---------- CALCULATE AGGREGATES ----------
    // ---------- CALCULATE AGGREGATES ----------
    const contentCount = mediaWithInsights.length;

    // totals
    const totalLikes = mediaWithInsights.reduce((sum, m) => {
      const likes = m.insights?.data?.find(i => i.name === "likes")?.values?.[0]?.value || 0;
      return sum + likes;
    }, 0);

    const totalComments = mediaWithInsights.reduce((sum, m) => {
      const comments = m.insights?.data?.find(i => i.name === "comments")?.values?.[0]?.value || 0;
      return sum + comments;
    }, 0);

    const totalReach = mediaWithInsights.reduce((sum, m) => {
      const reach = m.insights?.data?.find(i => i.name === "reach")?.values?.[0]?.value || 0;
      return sum + reach;
    }, 0);

    const totalViews = mediaWithInsights.reduce((sum, m) => {
      const views = m.insights?.data?.find(i => i.name === "views")?.values?.[0]?.value || 0;
      return sum + views;
    }, 0);

    // averages
    const avgLikes = contentCount ? totalLikes / contentCount : 0;
    const avgComments = contentCount ? totalComments / contentCount : 0;
    const avgReach = contentCount ? totalReach / contentCount : 0;
    const avgViews = contentCount ? totalViews / contentCount : 0;

    // engagement rate formula
    const engagementRate = profile.followers_count > 0
      ? ((avgLikes + avgComments) / profile.followers_count) * 100
      : 0;


    await InfluencerInstagramAccount.upsert({
      influencer_id: influencerId,
      ig_user_id: user_id,
      username: profile.username,
      profile_picture_url: profile.profile_picture_url,
      biography: profile.biography,
      website: profile.website,
      access_token: longLived.access_token,
      token_expires_at: new Date(Date.now() + longLived.expires_in * 1000),
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
    });

    log("✅ Instagram connected for influencer:", influencerId);

    const frontendUrl = process.env.FRONTEND_URL;
    res.redirect(`${frontendUrl}/dashboard/influencer/settings`);
    
  } catch (err) {
    log("❌ Error during Instagram callback:", err);
    res.status(500).json({ error: "Authentication failed" });
  }
};

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



// ---------- FETCH SAVED DATA ----------
exports.getInstagramData = async (req, res) => {
  try {
    const influencerId = req.user?.id; // from JWT middleware
    if (!influencerId) {
      return res.status(401).json({ message: "Unauthorized. Login required." });
    }

    const account = await InfluencerInstagramAccount.findOne({
      where: { influencer_id: influencerId },
    });

    if (!account) {
      return res.status(404).json({ message: "Instagram account not connected" });
    }

    res.json({
      success: true,
      data: {
        ig_user_id: account.ig_user_id,
        username: account.username,
        profile_picture_url: account.profile_picture_url,
        biography: account.biography,
        website: account.website,
        followers_count: account.followers_count,
        follows_count: account.follows_count,
        media_count: account.media_count,

        // aggregates
        avg_likes: account.avg_likes,
        avg_comments: account.avg_comments,
        avg_reach: account.avg_reach,
        avg_views: account.avg_views,
        engagement_rate: account.total_engagements,

        // insights
        account_insights_day: account.account_insights_day,
        account_insights_30days: account.account_insights_30days,

        // media insights
        media_with_insights: account.media_with_insights,
      },
    });
  } catch (err) {
    log("❌ Error fetching Instagram data:", err);
    res.status(500).json({ error: "Failed to fetch Instagram data" });
  }
};

// controllers/InstagramInsight.controller.js
exports.getInstagramMedia = async (req, res) => {
  try {
    const influencerId = req.user.id;
    const account = await InfluencerInstagramAccount.findOne({
      where: { influencer_id: influencerId },
    });

    if (!account) {
      return res.status(404).json({ message: "Instagram not connected" });
    }

    res.json({
      success: true,
      media: account.media_with_insights || [],
    });
  } catch (err) {
    console.error("❌ Failed to fetch IG media:", err);
    res.status(500).json({ message: "Server error" });
  }
};


// Refresh + Re-fetch IG data
exports.refreshInstagramData = async (req, res) => {
  try {
    const influencerId = req.user.id;
    const account = await InfluencerInstagramAccount.findOne({
      where: { influencer_id: influencerId },
    });

    if (!account) {
      return res.status(404).json({ message: "Instagram account not connected" });
    }

    // 🔄 Refresh token if near expiry
    let accessToken = account.access_token;
    const expiresAt = new Date(account.token_expires_at);
    const now = new Date();

    if ((expiresAt - now) / (1000 * 60 * 60 * 24) < 7) { // if <7 days left
      const refreshRes = await axios.get(
        "https://graph.instagram.com/refresh_access_token",
        { params: { grant_type: "ig_refresh_token", access_token: accessToken } }
      );

      accessToken = refreshRes.data.access_token;
      account.access_token = accessToken;
      account.token_expires_at = new Date(Date.now() + refreshRes.data.expires_in * 1000);
      await account.save();
    }

    // 🔁 Re-fetch profile + media
    const profile = await safeRequest(
      `https://graph.instagram.com/v23.0/${account.ig_user_id}`,
      {
        params: {
          fields: "id,username,name,biography,profile_picture_url,website,followers_count,follows_count,media_count",
          access_token: accessToken,
        },
      },
      "Profile Refresh"
    );

    const media = await fetchAllMedia(accessToken);
    const stories = await fetchStories(account.ig_user_id, accessToken);

    // save refreshed data
    account.username = profile.username;
    account.profile_picture_url = profile.profile_picture_url;
    account.followers_count = profile.followers_count;
    account.follows_count = profile.follows_count;
    account.media_count = profile.media_count;
    account.media_with_insights = [...media, ...stories];

    await account.save();

    res.json({ success: true, message: "Instagram data refreshed", data: account });
  } catch (err) {
    console.error("❌ Failed to refresh IG data:", err);
    res.status(500).json({ error: "Failed to refresh IG data" });
  }
};
