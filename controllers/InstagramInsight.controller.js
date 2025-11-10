// instagram.controller.js (or wherever this file lives)
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
    const res = await axios.get(url, options);
    log(`✅ ${label} OK`);
    return res.data;
  } catch (err) {
    const payload = err.response?.data || { message: err.message, code: err.code };
    log(`❌ ${label} FAIL`, payload);
    // normalize
    const e = new Error(payload.error?.message || payload.message || "API error");
    e.code = payload.error?.code || payload.code || 0;
    throw e;
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
  // entity id (influencer primary key) – our middleware maps this for you
  const influencerEntityId = req.user?.influencer_id ?? req.user?.id;
  if (!influencerEntityId || req.user?.role !== "influencer") {
    return res.status(401).json({ message: "Unauthorized." });
  }

  // sign state to prevent tampering
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
  console.log("🔵 Instagram Callback Started - Query Parameters:", { code, state });
  
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
    console.log("📤 Short-lived token request params:", {
      client_id: process.env.INSTAGRAM_APP_ID?.substring(0, 10) + "...", // Partial for security
      client_secret: process.env.INSTAGRAM_APP_SECRET?.substring(0, 10) + "...", // Partial for security
      grant_type: "authorization_code",
      redirect_uri: process.env.REDIRECT_URI,
      code: code.substring(0, 10) + "...", // Partial for security
    });

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

    console.log("✅ Short-lived token response:", {
      status: tokenRes.status,
      data: tokenRes.data
    });
    
    const { access_token: shortToken, user_id } = tokenRes.data;
    console.log("🔑 Short-lived token received:", shortToken);
    console.log("👤 User ID:", user_id);

    // 2) Long-lived token (use short-lived to exchange)
    console.log("🟡 Step 2: Exchanging for long-lived token...");
    console.log("📤 Long-lived token request params:", {
      grant_type: "ig_exchange_token",
      client_secret: process.env.INSTAGRAM_APP_SECRET?.substring(0, 10) + "...",
      access_token: shortToken.substring(0, 20) + "...", // Partial token for log
    });

    const longLivedRes = await axios.get(
      "https://graph.instagram.com/access_token",
      {
        params: {
          grant_type: "ig_exchange_token",
          client_secret: process.env.INSTAGRAM_APP_SECRET,
          access_token: shortToken,
        },
      }
    );

    console.log("✅ Long-lived token response:", {
      status: longLivedRes.status,
      data: longLivedRes.data
    });

    // pull the actual values out of .data
    const igToken = longLivedRes.data.access_token;
    const igTokenExpiresIn = longLivedRes.data.expires_in;
    
    console.log("🔑 Long-lived token received:", igToken);
    console.log("⏰ Token expires in:", igTokenExpiresIn, "seconds");

    // 3) Basic profile
    console.log("🟡 Step 3: Fetching basic profile...");
    console.log("📤 Profile request:", {
      url: `https://graph.instagram.com/v23.0/${user_id}`,
      token: igToken.substring(0, 20) + "...", // Partial token for log
      fields: "id,username,name,biography,profile_picture_url,website,followers_count,follows_count,media_count"
    });

    const profile = await safeRequest(
      `https://graph.instagram.com/v23.0/${user_id}`,
      {
        params: {
          fields:
            "id,username,name,biography,profile_picture_url,website,followers_count,follows_count,media_count",
          access_token: igToken, // <-- use the long-lived token
        },
      },
      "Profile Basic"
    );

    console.log("✅ Profile data received:", {
      username: profile.username,
      followers_count: profile.followers_count,
      media_count: profile.media_count
    });

    // 4) Content pulls
    console.log("🟡 Step 4: Fetching content...");
    console.log("📤 Media fetch token:", igToken.substring(0, 20) + "...");
    
    const media = await fetchAllMedia(igToken);
    const stories = await fetchStories(user_id, igToken);
    const allContent = [...media, ...stories];

    console.log("✅ Content fetched:", {
      media_count: media.length,
      stories_count: stories.length,
      total_content: allContent.length
    });

    const MAX_STORE = 200;
    const contentToFetch = allContent.slice(0, MAX_STORE);
    console.log(`📝 Processing ${contentToFetch.length} items for insights`);

    console.log("🟡 Step 5: Fetching media insights...");
    const mediaWithInsights = await Promise.all(
      contentToFetch.map(async (m, index) => {
        console.log(`📊 Fetching insights for media ${index + 1}/${contentToFetch.length}:`, {
          id: m.id,
          media_type: m.media_type,
          token: igToken.substring(0, 20) + "..."
        });
        
        try {
          const metrics = getMetricsForType(m.media_type);
          console.log(`   Metrics for ${m.media_type}:`, metrics);
          
          const insights = await safeRequest(
            `https://graph.instagram.com/v23.0/${m.id}/insights`,
            {
              params: {
                metric: metrics,
                access_token: igToken, // <-- use long-lived token
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

    // 5) Daily metrics
    console.log("🟡 Step 6: Fetching daily account insights...");
    const dayMetrics = [
      "accounts_engaged",
      "total_interactions",
      "reach",
      "impressions",
      "views",
    ];
    const insightsDay = {};
    
    console.log("📤 Daily insights token:", igToken.substring(0, 20) + "...");
    
    for (const metric of dayMetrics) {
      console.log(`   📈 Fetching daily metric: ${metric}`);
      try {
        insightsDay[metric] = await safeRequestWithRetry(
          `https://graph.instagram.com/v23.0/${user_id}/insights`,
          {
            params: {
              metric,
              period: "day",
              access_token: igToken, // <-- use long-lived token
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

    // 6) 30-day / lifetime metrics
    console.log("🟡 Step 7: Fetching 30-day/lifetime insights...");
    const insights30Days = {};
    const metrics30Config = [
      {
        name: "engaged_audience_demographics",
        params: { period: "lifetime", breakdown: "gender,country" },
      },
      {
        name: "follower_demographics",
        params: { period: "lifetime", breakdown: "gender,country" },
      },
    ];
    
    console.log("📤 30-day insights token:", igToken.substring(0, 20) + "...");
    
    for (const metric of metrics30Config) {
      console.log(`   📊 Fetching 30-day metric: ${metric.name}`);
      try {
        insights30Days[metric.name] = await safeRequestWithRetry(
          `https://graph.instagram.com/v23.0/${user_id}/insights`,
          {
            params: {
              ...metric.params,
              metric: metric.name,
              access_token: igToken, // <-- use long-lived token
            },
          },
          `Account Insights (30 days) - ${metric.name}`
        );
        console.log(`   ✅ 30-day metric ${metric.name} received`);
      } catch (err) {
        console.log(`   ❌ 30-day metric ${metric.name} failed:`, err.message);
        insights30Days[metric.name] = { error: err.message, code: err.code };
      }
    }

    // 7) Aggregates
    console.log("🟡 Step 8: Calculating aggregates...");
    const contentCount = mediaWithInsights.length || 1;
    const take = (m, n) =>
      m.insights?.data?.find((i) => i.name === n)?.values?.[0]?.value ?? 0;

    const totals = mediaWithInsights.reduce(
      (acc, m) => ({
        likes: acc.likes + (Number(take(m, "likes")) || 0),
        comments: acc.comments + (Number(take(m, "comments")) || 0),
        reach: acc.reach + (Number(take(m, "reach")) || 0),
        views: acc.views + (Number(take(m, "views")) || 0),
      }),
      { likes: 0, comments: 0, reach: 0, views: 0 }
    );

    const avgs = {
      avg_likes: Number((totals.likes / contentCount).toFixed(2)),
      avg_comments: Number((totals.comments / contentCount).toFixed(2)),
      avg_reach: Number((totals.reach / contentCount).toFixed(2)),
      avg_views: Number((totals.views / contentCount).toFixed(2)),
    };

    const engagement_rate =
      profile.followers_count > 0
        ? Number(
            (
              ((avgs.avg_likes + avgs.avg_comments) / profile.followers_count) *
              100
            ).toFixed(3)
          )
        : 0;

    console.log("✅ Aggregates calculated:", {
      contentCount,
      totals,
      avgs,
      engagement_rate
    });

    // 8) Persist
    console.log("🟡 Step 9: Persisting data to database...");
    console.log("💾 Storing token (full):", igToken);
    console.log("💾 Token expires at:", new Date(Date.now() + (Number(igTokenExpiresIn) || 0) * 1000));
    
    await InfluencerInstagramAccount.upsert({
      influencer_id: influencerId,
      ig_user_id: user_id,
      username: profile.username,
      profile_picture_url: profile.profile_picture_url,
      biography: profile.biography,
      website: profile.website,
      access_token: igToken, // <-- store long-lived token
      token_expires_at: new Date(
        Date.now() + (Number(igTokenExpiresIn) || 0) * 1000
      ),
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
    console.log("🔀 Redirecting to:", `${frontendUrl}/dashboard/influencer/settings?instagram=connected`);
    
    return res.redirect(
      `${frontendUrl}/dashboard/influencer/settings?instagram=connected`
    );
  } catch (err) {
    console.log("❌ Instagram callback error:", {
      message: err.message,
      code: err.code,
      stack: err.stack
    });
    return res.status(500).json({ error: "Authentication failed" });
  }
};



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
    if (Array.isArray(res?.data)) {
      allMedia = allMedia.concat(res.data);
      url = res.paging?.next || null;
      params = {}; // next URL already contains tokens and fields
    } else {
      url = null;
    }
  }
  return allMedia;
}

async function fetchStories(userId, token) {
  try {
    const res = await safeRequest(
      `https://graph.instagram.com/${userId}/stories`,
      { params: { fields: "id,media_type,media_url,permalink,timestamp", access_token: token } },
      "Stories List"
    );
    return Array.isArray(res?.data) ? res.data : [];
  } catch {
    return [];
  }
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

    if (!Number.isFinite(expiresAt.getTime()) || (expiresAt - now) / (1000 * 60 * 60 * 24) < 7) {
      const refreshRes = await axios.get(
        "https://graph.instagram.com/refresh_access_token",
        { params: { grant_type: "ig_refresh_token", access_token: accessToken } }
      );
      accessToken = refreshRes.data.access_token;
      account.access_token = accessToken;
      account.token_expires_at = new Date(Date.now() + (Number(refreshRes.data.expires_in) || 0) * 1000);
      await account.save();
    }

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

    const MAX_STORE = 200;
    account.username = profile.username;
    account.profile_picture_url = profile.profile_picture_url;
    account.followers_count = profile.followers_count;
    account.follows_count = profile.follows_count;
    account.media_count = profile.media_count;
    account.media_with_insights = [...media, ...stories].slice(0, MAX_STORE);
    account.updated_at = new Date();

    await account.save();

    res.json({ success: true, message: "Instagram data refreshed", data: account });
  } catch (err) {
    log("❌ Failed to refresh IG data:", err.message);
    res.status(500).json({ error: "Failed to refresh IG data" });
  }
};
