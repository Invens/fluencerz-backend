// instagram.controller.js
const axios = require("axios");
const jwt = require("jsonwebtoken");
const db = require("../models");
const InfluencerInstagramAccount = db.InfluencerInstagramAccount;

function log(...args) {
  console.log("[IG]", ...args);
}

function sanitize(obj) {
  if (!obj) return obj;
  const copy = { ...obj };
  if (copy.headers?.Authorization) copy.headers.Authorization = "***";
  if (copy.params?.access_token) copy.params.access_token = "***";
  return copy;
}

async function safeRequest(url, options = {}, label = "API REQUEST") {
  try {
    log(`➡️ ${label}`, sanitize({ url, ...options }));
    const res = await axios.get(url, {
      ...options,
      timeout: 30000,
      validateStatus: function (status) {
        return status < 500; // Resolve only if the status code is less than 500
      }
    });
    
    log(`✅ ${label} OK`, { status: res.status });
    
    // Check if response contains error
    if (res.data && res.data.error) {
      log(`❌ ${label} API Error`, res.data.error);
      const error = new Error(res.data.error.message || "Instagram API error");
      error.code = res.data.error.code;
      throw error;
    }
    
    return res.data;
  } catch (err) {
    if (err.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const payload = err.response.data || { message: err.message };
      log(`❌ ${label} FAIL`, { 
        status: err.response.status,
        data: payload 
      });
      
      const error = new Error(payload.error?.message || payload.message || "API error");
      error.code = payload.error?.code || payload.code || err.response.status;
      throw error;
    } else if (err.request) {
      // The request was made but no response was received
      log(`❌ ${label} FAIL - No Response`, { message: err.message });
      throw new Error("No response from Instagram API");
    } else {
      // Something happened in setting up the request that triggered an Error
      log(`❌ ${label} FAIL - Setup Error`, { message: err.message });
      throw err;
    }
  }
}

async function safeRequestWithRetry(url, options, label, maxRetries = 2) {
  let attempt = 0;
  for (;;) {
    try {
      return await safeRequest(url, options, label);
    } catch (err) {
      attempt++;
      // IG often uses error codes like 4 (rate limit), 2 (service), 17 (user check) → retryable
      const retryable = [2, 4, 17, 613].includes(Number(err.code));
      if (!retryable || attempt > maxRetries) throw err;
      const delay = 1000 * Math.pow(2, attempt - 1);
      log(`⚠️ Retry ${attempt}/${maxRetries} in ${delay}ms for ${label} (code ${err.code})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ---------- METRICS SELECTOR ----------
function getMetricsForType(mediaType) {
  switch (mediaType) {
    case "IMAGE":
    case "CAROUSEL_ALBUM":
      return "engagements,impressions,reach,saved,shares";
    case "VIDEO":
    case "REEL":
      return "engagements,impressions,reach,saved,shares,video_views";
    case "STORY":
      return "exits,impressions,reach,replies,taps_forward,taps_back";
    default:
      return "engagements,impressions,reach";
  }
}

// ---------- STEP 1: AUTH ----------
exports.authInstagram = (req, res) => {
  const influencerEntityId = req.user?.influencer_id ?? req.user?.id;
  if (!influencerEntityId || req.user?.role !== "influencer") {
    return res.status(401).json({ message: "Unauthorized." });
  }

  const state = jwt.sign(
    { influencer_id: influencerEntityId },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

  const authUrl =
    `https://www.instagram.com/oauth/authorize?force_reauth=true` +
    `&client_id=${process.env.INSTAGRAM_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=instagram_business_basic,instagram_business_manage_insights` +
    `&state=${encodeURIComponent(state)}`;

  return res.json({ url: authUrl });
};

// ---------- STEP 2: CALLBACK ----------
exports.instagramCallback = async (req, res) => {
  const { code, state } = req.query;
  console.log("🔵 Instagram Callback Started - Query Parameters:", { 
    code: code ? `${code.substring(0, 10)}...` : null, 
    state 
  });
  
  if (!code || !state) {
    console.log("❌ Missing authorization code or state");
    return res.status(400).send("Missing authorization code or state");
  }

  let influencerId;
  try {
    const decoded = jwt.verify(state, process.env.JWT_SECRET);
    influencerId = decoded.influencer_id;
    console.log("✅ State JWT verified - Influencer ID:", influencerId);
  } catch (error) {
    console.log("❌ JWT verification failed:", error.message);
    return res.status(400).send("Invalid or expired state");
  }

  try {
    // 1) Short-lived token
    console.log("🟡 Step 1: Requesting short-lived token...");
    
    const tokenRes = await axios.post(
      "https://api.instagram.com/oauth/access_token",
      new URLSearchParams({
        client_id: process.env.INSTAGRAM_APP_ID,
        client_secret: process.env.INSTAGRAM_APP_SECRET,
        grant_type: "authorization_code",
        redirect_uri: process.env.REDIRECT_URI,
        code,
      }),
      { 
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 30000
      }
    );

    console.log("✅ Short-lived token response:", {
      status: tokenRes.status,
      access_token_length: tokenRes.data.access_token?.length,
      user_id: tokenRes.data.user_id,
      permissions: tokenRes.data.permissions
    });
    
    const { access_token: shortToken, user_id } = tokenRes.data;

    // 2) Long-lived token - FIXED: Use correct endpoint and parameters
    console.log("🟡 Step 2: Exchanging for long-lived token...");
    
    // Test short token first
    console.log("🟡 Testing short-lived token...");
    try {
      const testResponse = await axios.get(
        `https://graph.instagram.com/me`,
        {
          params: {
            fields: 'id,username',
            access_token: shortToken
          },
          timeout: 30000
        }
      );
      console.log("✅ Short-lived token test successful:", testResponse.data);
    } catch (testError) {
      console.log("❌ Short-lived token test failed:", {
        status: testError.response?.status,
        data: testError.response?.data,
        message: testError.message
      });
    }

    // Get long-lived token - CORRECT ENDPOINT AND PARAMS
    const longLivedRes = await axios.get(
      "https://graph.instagram.com/access_token",
      {
        params: {
          grant_type: "ig_exchange_token",
          client_secret: process.env.INSTAGRAM_APP_SECRET,
          access_token: shortToken,
        },
        timeout: 30000
      }
    );

    console.log("✅ Long-lived token response:", {
      status: longLivedRes.status,
      access_token_length: longLivedRes.data.access_token?.length,
      token_type: longLivedRes.data.token_type,
      expires_in: longLivedRes.data.expires_in
    });

    const igToken = longLivedRes.data.access_token;
    const igTokenExpiresIn = longLivedRes.data.expires_in;

    // Test long-lived token immediately
    console.log("🟡 Testing long-lived token...");
    try {
      const testResponse = await axios.get(
        `https://graph.instagram.com/me`,
        {
          params: {
            fields: 'id,username',
            access_token: igToken
          },
          timeout: 30000
        }
      );
      console.log("✅ Long-lived token test successful:", testResponse.data);
    } catch (testError) {
      console.log("❌ Long-lived token test failed:", {
        status: testError.response?.status,
        data: testError.response?.data,
        message: testError.message
      });
      throw new Error(`Long-lived token invalid: ${testError.response?.data?.error?.message || testError.message}`);
    }

    // 3) Basic profile - Use 'me' instead of user_id for better compatibility
    console.log("🟡 Step 3: Fetching basic profile...");
    
    const profile = await safeRequest(
      `https://graph.instagram.com/me`,
      {
        params: {
          fields: "id,username,name,biography,profile_picture_url,website,followers_count,follows_count,media_count",
          access_token: igToken,
        },
      },
      "Profile Basic"
    );

    console.log("✅ Profile data received:", {
      id: profile.id,
      username: profile.username,
      followers_count: profile.followers_count,
      media_count: profile.media_count
    });

    // 4) Content pulls
    console.log("🟡 Step 4: Fetching content...");
    
    const media = await fetchAllMedia(igToken);
    const stories = await fetchStories(profile.id, igToken);
    const allContent = [...media, ...stories];

    console.log("✅ Content fetched:", {
      media_count: media.length,
      stories_count: stories.length,
      total_content: allContent.length
    });

    const MAX_STORE = 200;
    const contentToFetch = allContent.slice(0, MAX_STORE);
    console.log(`📝 Processing ${contentToFetch.length} items for insights`);

    // 5) Media insights
    console.log("🟡 Step 5: Fetching media insights...");
    const mediaWithInsights = await Promise.all(
      contentToFetch.map(async (m, index) => {
        console.log(`📊 Fetching insights for media ${index + 1}/${contentToFetch.length}:`, {
          id: m.id,
          media_type: m.media_type
        });
        
        try {
          const metrics = getMetricsForType(m.media_type);
          const insights = await safeRequest(
            `https://graph.instagram.com/${m.id}/insights`,
            {
              params: {
                metric: metrics,
                access_token: igToken,
              },
            },
            `Media Insights ${m.id}`
          );
          console.log(`   ✅ Insights received for ${m.id}`);
          return { ...m, insights };
        } catch (err) {
          console.log(`   ❌ Insights error for ${m.id}:`, err.message);
          return {
            ...m,
            insights: null,
            _insights_error: err.message,
            _code: err.code,
          };
        }
      })
    );

    console.log("✅ Media insights completed:", {
      successful: mediaWithInsights.filter(m => m.insights).length,
      failed: mediaWithInsights.filter(m => !m.insights).length
    });

    // 6) Daily metrics - Only fetch basic metrics to avoid rate limits
    console.log("🟡 Step 6: Fetching daily account insights...");
    const dayMetrics = ["reach", "impressions"];
    const insightsDay = {};
    
    for (const metric of dayMetrics) {
      console.log(`   📈 Fetching daily metric: ${metric}`);
      try {
        insightsDay[metric] = await safeRequestWithRetry(
          `https://graph.instagram.com/me/insights`,
          {
            params: {
              metric,
              period: "day",
              access_token: igToken,
            },
          },
          `Account Insights (day) - ${metric}`
        );
        console.log(`   ✅ Daily metric ${metric} received`);
      } catch (err) {
        console.log(`   ❌ Daily metric ${metric} failed:`, err.message);
        insightsDay[metric] = { error: err.message, code: err.code };
      }
    }

    // 7) 30-day / lifetime metrics - Simplify to avoid complex endpoints
    console.log("🟡 Step 7: Fetching follower count insight...");
    const insights30Days = {};
    
    try {
      insights30Days.follower_count = await safeRequestWithRetry(
        `https://graph.instagram.com/me/insights`,
        {
          params: {
            metric: "follower_count",
            period: "lifetime",
            access_token: igToken,
          },
        },
        `Follower Count Insight`
      );
      console.log("✅ Follower count insight received");
    } catch (err) {
      console.log("❌ Follower count insight failed:", err.message);
      insights30Days.follower_count = { error: err.message, code: err.code };
    }

    // 8) Aggregates
    console.log("🟡 Step 8: Calculating aggregates...");
    const contentCount = mediaWithInsights.length || 1;
    
    const take = (m, metricName) => {
      if (!m.insights?.data) return 0;
      const metric = m.insights.data.find(i => i.name === metricName);
      return Number(metric?.values?.[0]?.value) || 0;
    };

    const totals = mediaWithInsights.reduce(
      (acc, m) => ({
        likes: acc.likes + take(m, "engagements"),
        comments: acc.comments + take(m, "comments"), // Note: comments might not be available
        reach: acc.reach + take(m, "reach"),
        views: acc.views + take(m, "video_views"),
      }),
      { likes: 0, comments: 0, reach: 0, views: 0 }
    );

    const avgs = {
      avg_likes: Number((totals.likes / contentCount).toFixed(2)),
      avg_comments: Number((totals.comments / contentCount).toFixed(2)),
      avg_reach: Number((totals.reach / contentCount).toFixed(2)),
      avg_views: Number((totals.views / contentCount).toFixed(2)),
    };

    const engagement_rate = profile.followers_count > 0
      ? Number((((avgs.avg_likes + avgs.avg_comments) / profile.followers_count) * 100).toFixed(3))
      : 0;

    console.log("✅ Aggregates calculated:", {
      contentCount,
      totals,
      avgs,
      engagement_rate
    });

    // 9) Persist
    console.log("🟡 Step 9: Persisting data to database...");
    
    await InfluencerInstagramAccount.upsert({
      influencer_id: influencerId,
      ig_user_id: profile.id, // Use profile.id instead of user_id for consistency
      username: profile.username,
      profile_picture_url: profile.profile_picture_url,
      biography: profile.biography,
      website: profile.website,
      access_token: igToken,
      token_expires_at: new Date(Date.now() + (Number(igTokenExpiresIn) || 0) * 1000),
      followers_count: profile.followers_count,
      follows_count: profile.follows_count,
      media_count: profile.media_count,
      account_insights_day: insightsDay,
      account_insights_30days: insights30Days,
      media_with_insights: mediaWithInsights,
      ...avgs,
      engagement_rate,
      updated_at: new Date(),
    });

    console.log("✅ Instagram connected for influencer:", influencerId);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    console.log("🔀 Redirecting to frontend...");
    
    return res.redirect(
      `${frontendUrl}/dashboard/influencer/settings?instagram=connected`
    );
  } catch (err) {
    console.log("❌ Instagram callback error:", {
      message: err.message,
      code: err.code,
      response_data: err.response?.data
    });
    
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    return res.redirect(
      `${frontendUrl}/dashboard/influencer/settings?instagram=error&message=${encodeURIComponent(err.message)}`
    );
  }
};

async function fetchAllMedia(token) {
  let allMedia = [];
  let url = `https://graph.instagram.com/me/media`;
  let params = {
    fields: "id,caption,media_type,media_url,permalink,timestamp,thumbnail_url,username",
    access_token: token,
    limit: 50,
  };

  let attempt = 0;
  const maxAttempts = 3;
  
  while (url && attempt < maxAttempts) {
    try {
      const res = await safeRequest(url, { params }, "Media List");
      if (Array.isArray(res?.data)) {
        allMedia = allMedia.concat(res.data);
        url = res.paging?.next || null;
        params = {}; // next URL already contains tokens and fields
        attempt = 0; // reset attempt counter on success
      } else {
        url = null;
      }
    } catch (err) {
      attempt++;
      if (attempt >= maxAttempts) {
        console.log("❌ Failed to fetch media after retries:", err.message);
        break;
      }
      console.log(`⚠️ Retrying media fetch (attempt ${attempt}/${maxAttempts})...`);
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
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
  } catch (err) {
    console.log("⚠️ Could not fetch stories:", err.message);
    return [];
  }
}

// ---------- FETCH SAVED DATA ----------
exports.getInstagramData = async (req, res) => {
  try {
    const influencerId = req.user?.influencer_id ?? req.user?.id;
    if (!influencerId) return res.status(401).json({ message: "Unauthorized." });

    const account = await InfluencerInstagramAccount.findOne({
      where: { influencer_id: influencerId },
    });
    if (!account) return res.status(404).json({ message: "Instagram account not connected" });

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
        avg_likes: account.avg_likes,
        avg_comments: account.avg_comments,
        avg_reach: account.avg_reach,
        avg_views: account.avg_views,
        engagement_rate: account.engagement_rate,
        account_insights_day: account.account_insights_day,
        account_insights_30days: account.account_insights_30days,
        media_with_insights: account.media_with_insights,
      },
    });
  } catch (err) {
    log("❌ Error fetching Instagram data:", err.message);
    res.status(500).json({ error: "Failed to fetch Instagram data" });
  }
};

exports.getInstagramMedia = async (req, res) => {
  try {
    const influencerId = req.user?.influencer_id ?? req.user?.id;
    const account = await InfluencerInstagramAccount.findOne({
      where: { influencer_id: influencerId },
    });
    if (!account) return res.status(404).json({ message: "Instagram not connected" });

    res.json({ success: true, media: account.media_with_insights || [] });
  } catch (err) {
    log("❌ Failed to fetch IG media:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.refreshInstagramData = async (req, res) => {
  try {
    const influencerId = req.user?.influencer_id ?? req.user?.id;
    const account = await InfluencerInstagramAccount.findOne({
      where: { influencer_id: influencerId },
    });
    if (!account) return res.status(404).json({ message: "Instagram account not connected" });

    let accessToken = account.access_token;
    const expiresAt = new Date(account.token_expires_at);
    const now = new Date();

    // Refresh token if it expires in less than 7 days
    if (!Number.isFinite(expiresAt.getTime()) || (expiresAt - now) / (1000 * 60 * 60 * 24) < 7) {
      console.log("🟡 Refreshing access token...");
      const refreshRes = await axios.get(
        "https://graph.instagram.com/refresh_access_token",
        { 
          params: { 
            grant_type: "ig_refresh_token", 
            access_token: accessToken 
          },
          timeout: 30000
        }
      );
      accessToken = refreshRes.data.access_token;
      account.access_token = accessToken;
      account.token_expires_at = new Date(Date.now() + (Number(refreshRes.data.expires_in) || 0) * 1000);
      await account.save();
      console.log("✅ Token refreshed");
    }

    // Fetch updated profile
    const profile = await safeRequest(
      `https://graph.instagram.com/me`,
      {
        params: {
          fields: "id,username,name,biography,profile_picture_url,website,followers_count,follows_count,media_count",
          access_token: accessToken,
        },
      },
      "Profile Refresh"
    );

    // Update basic profile data
    account.username = profile.username;
    account.profile_picture_url = profile.profile_picture_url;
    account.biography = profile.biography;
    account.website = profile.website;
    account.followers_count = profile.followers_count;
    account.follows_count = profile.follows_count;
    account.media_count = profile.media_count;
    account.updated_at = new Date();

    await account.save();

    res.json({ 
      success: true, 
      message: "Instagram data refreshed", 
      data: {
        username: profile.username,
        followers_count: profile.followers_count,
        media_count: profile.media_count
      }
    });
  } catch (err) {
    log("❌ Failed to refresh IG data:", err.message);
    res.status(500).json({ error: "Failed to refresh IG data" });
  }
};