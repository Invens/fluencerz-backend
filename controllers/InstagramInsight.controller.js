// instagram.controller.js
const axios = require("axios");
const jwt = require("jsonwebtoken");
const db = require("../models");
const InfluencerInstagramAccount = db.InfluencerInstagramAccount;

function log(...args) {
  console.log("[IG]", ...args);
}

function sanitizeForLog(obj) {
  if (!obj) return obj;
  const copy = JSON.parse(JSON.stringify(obj));
  if (copy.headers?.Authorization) copy.headers.Authorization = "***";
  if (copy.headers?.authorization) copy.headers.authorization = "***";
  if (copy.params?.access_token) copy.params.access_token = "***";
  if (copy.data?.access_token) copy.data.access_token = "***";
  return copy;
}

async function safeRequest(url, options = {}, label = "API REQUEST") {
  log(`➡️ ${label}`, sanitizeForLog({ url, ...options }));
  
  try {
    const res = await axios.get(url, {
      ...options,
      timeout: 30000,
      validateStatus: function (status) {
        return status < 500;
      }
    });
    
    log(`✅ ${label} OK`, { status: res.status });
    
    if (res.data && res.data.error) {
      log(`❌ ${label} API Error`, res.data.error);
      const error = new Error(res.data.error.message || "Instagram API error");
      error.code = res.data.error.code;
      throw error;
    }
    
    return res.data;
  } catch (err) {
    if (err.response) {
      const payload = err.response.data || { message: err.message };
      log(`❌ ${label} FAIL`, { 
        status: err.response.status,
        data: payload 
      });
      
      const error = new Error(payload.error?.message || payload.message || "API error");
      error.code = payload.error?.code || payload.code || err.response.status;
      throw error;
    } else if (err.request) {
      log(`❌ ${label} FAIL - No Response`, { message: err.message });
      throw new Error("No response from Instagram API");
    } else {
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
      const retryable = [2, 4, 17, 613].includes(Number(err.code));
      if (!retryable || attempt > maxRetries) throw err;
      const delay = 1000 * Math.pow(2, attempt - 1);
      log(`⚠️ Retry ${attempt}/${maxRetries} in ${delay}ms for ${label} (code ${err.code})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// ---------- METRICS SELECTOR - SIMPLIFIED TO BASIC METRICS ----------
function getMetricsForType(mediaType) {
  // Use only basic metrics that work for most media types
  const basicMetrics = "likes,comments,reach,saved,shares";
  const videoMetrics = "likes,comments,reach,saved,shares,views";
  
  switch (mediaType) {
    case "IMAGE":
    case "CAROUSEL_ALBUM":
      return basicMetrics;
    case "VIDEO":
    case "REEL":
      return videoMetrics;
    case "STORY":
      return "reach,replies";
    default:
      return basicMetrics;
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

    // 2) Long-lived token
    console.log("🟡 Step 2: Exchanging for long-lived token...");

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

    // Test long-lived token
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

    // 3) Basic profile
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

    // 5) Media insights - with simplified metrics and better error handling
    console.log("🟡 Step 5: Fetching media insights...");
    const mediaWithInsights = await Promise.all(
      contentToFetch.map(async (m, index) => {
        console.log(`📊 Fetching insights for media ${index + 1}/${contentToFetch.length}:`, {
          id: m.id,
          media_type: m.media_type
        });
        
        try {
          const metrics = getMetricsForType(m.media_type);
          console.log(`   Using metrics for ${m.media_type}:`, metrics);
          
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
          
          // Check if it's a "pre-conversion" error (posted before business account)
          if (err.message.includes('पर्सनल अकाउंट') || err.message.includes('personal account') || err.code === 2108006) {
            console.log(`   ⚠️ Media ${m.id} was posted before business account conversion`);
            return {
              ...m,
              insights: null,
              _insights_error: "Posted before business account conversion",
              _code: err.code,
            };
          }
          
          return {
            ...m,
            insights: null,
            _insights_error: err.message,
            _code: err.code,
          };
        }
      })
    );

    const successfulInsights = mediaWithInsights.filter(m => m.insights).length;
    const failedInsights = mediaWithInsights.filter(m => !m.insights).length;
    
    console.log("✅ Media insights completed:", {
      successful: successfulInsights,
      failed: failedInsights
    });

    // 6) Account insights
    console.log("🟡 Step 6: Fetching account insights...");
    const insightsDay = {};
    
    const availableAccountMetrics = [
      { name: "reach", period: "day" },
      { name: "profile_views", period: "day" },
      { name: "website_clicks", period: "day" },
      { name: "likes", period: "day" },
      { name: "comments", period: "day" },
      { name: "shares", period: "day" },
      { name: "saves", period: "day" }
    ];
    
    for (const metric of availableAccountMetrics) {
      console.log(`   📈 Fetching account metric: ${metric.name}`);
      try {
        insightsDay[metric.name] = await safeRequestWithRetry(
          `https://graph.instagram.com/me/insights`,
          {
            params: {
              metric: metric.name,
              period: metric.period,
              access_token: igToken,
            },
          },
          `Account Insights - ${metric.name}`
        );
        console.log(`   ✅ Account metric ${metric.name} received`);
      } catch (err) {
        console.log(`   ❌ Account metric ${metric.name} failed:`, err.message);
        insightsDay[metric.name] = { error: err.message, code: err.code };
      }
    }

    // 7) Lifetime metrics
    console.log("🟡 Step 7: Fetching lifetime insights...");
    const insightsLifetime = {};
    
    const lifetimeMetrics = [
      { name: "total_interactions", period: "lifetime" }
    ];
    
    for (const metric of lifetimeMetrics) {
      console.log(`   📊 Fetching lifetime metric: ${metric.name}`);
      try {
        insightsLifetime[metric.name] = await safeRequestWithRetry(
          `https://graph.instagram.com/me/insights`,
          {
            params: {
              metric: metric.name,
              period: metric.period,
              access_token: igToken,
            },
          },
          `Lifetime Insights - ${metric.name}`
        );
        console.log(`   ✅ Lifetime metric ${metric.name} received`);
      } catch (err) {
        console.log(`   ❌ Lifetime metric ${metric.name} failed:`, err.message);
        insightsLifetime[metric.name] = { error: err.message, code: err.code };
      }
    }

    // 8) DEMOGRAPHIC DATA - Try multiple approaches
    console.log("🟡 Step 8: Fetching demographic data...");
    const audienceDemographics = {};

    // Try different demographic endpoints
    const demographicMetrics = [
      { 
        name: "follower_demographics", 
        params: { period: "lifetime", breakdown: "gender" },
        description: "Follower gender demographics"
      },
      { 
        name: "follower_demographics", 
        params: { period: "lifetime", breakdown: "country" },
        description: "Follower country demographics"
      },
      { 
        name: "engaged_audience_demographics", 
        params: { period: "lifetime", breakdown: "gender" },
        description: "Engaged audience gender"
      },
      { 
        name: "engaged_audience_demographics", 
        params: { period: "lifetime", breakdown: "country" },
        description: "Engaged audience country"
      },
      { 
        name: "reached_audience_demographics", 
        params: { period: "lifetime", breakdown: "gender" },
        description: "Reached audience gender"
      },
      { 
        name: "reached_audience_demographics", 
        params: { period: "lifetime", breakdown: "country" },
        description: "Reached audience country"
      }
    ];

    for (const metric of demographicMetrics) {
      console.log(`   👥 Fetching demographic: ${metric.description}`);
      try {
        const result = await safeRequestWithRetry(
          `https://graph.instagram.com/me/insights`,
          {
            params: {
              metric: metric.name,
              ...metric.params,
              access_token: igToken,
            },
          },
          `Demographics - ${metric.name}_${metric.params.breakdown}`
        );
        
        audienceDemographics[`${metric.name}_${metric.params.breakdown}`] = result;
        console.log(`   ✅ Demographic ${metric.name}_${metric.params.breakdown} received`);
        
        // Log the actual data structure
        if (result?.data && result.data.length > 0) {
          console.log(`   📊 Data received:`, JSON.stringify(result.data, null, 2).substring(0, 500));
        } else {
          console.log(`   📊 No data returned for ${metric.name}_${metric.params.breakdown}`);
        }
      } catch (err) {
        console.log(`   ❌ Demographic ${metric.name}_${metric.params.breakdown} failed:`, err.message);
        audienceDemographics[`${metric.name}_${metric.params.breakdown}`] = { error: err.message, code: err.code };
      }
    }

    // 9) Process and structure demographic data
    console.log("🟡 Step 9: Processing demographic data...");
    const processedDemographics = processDemographicData(audienceDemographics);
    
    console.log("✅ Processed demographics:", {
      hasGenderData: !!processedDemographics.gender,
      hasCountryData: !!processedDemographics.country,
      genderData: processedDemographics.gender,
      countryData: processedDemographics.country ? Object.keys(processedDemographics.country).slice(0, 5) : null
    });

    // 10) Aggregates
    console.log("🟡 Step 10: Calculating aggregates...");
    
    let avgs = {
      avg_likes: 0,
      avg_comments: 0,
      avg_reach: 0,
      avg_views: 0,
    };
    
    let engagement_rate = 0;

    if (successfulInsights > 0) {
      const contentCount = successfulInsights;
      
      const take = (m, metricName) => {
        if (!m.insights?.data) return 0;
        const metric = m.insights.data.find(i => i.name === metricName);
        return Number(metric?.values?.[0]?.value) || 0;
      };

      const totals = mediaWithInsights.reduce(
        (acc, m) => ({
          likes: acc.likes + (m.insights ? take(m, "likes") : 0),
          comments: acc.comments + (m.insights ? take(m, "comments") : 0),
          reach: acc.reach + (m.insights ? take(m, "reach") : 0),
          views: acc.views + (m.insights ? take(m, "views") : 0),
        }),
        { likes: 0, comments: 0, reach: 0, views: 0 }
      );

      avgs = {
        avg_likes: Number((totals.likes / contentCount).toFixed(2)),
        avg_comments: Number((totals.comments / contentCount).toFixed(2)),
        avg_reach: Number((totals.reach / contentCount).toFixed(2)),
        avg_views: Number((totals.views / contentCount).toFixed(2)),
      };

      engagement_rate = profile.followers_count > 0
        ? Number((((avgs.avg_likes + avgs.avg_comments) / profile.followers_count) * 100).toFixed(3))
        : 0;
    }

    console.log("✅ Aggregates calculated:", {
      contentCount: successfulInsights,
      avgs,
      engagement_rate
    });

    // 11) Persist
    console.log("🟡 Step 11: Persisting data to database...");
    
    await InfluencerInstagramAccount.upsert({
      influencer_id: influencerId,
      ig_user_id: profile.id,
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
      account_insights_lifetime: insightsLifetime,
      audience_demographics: processedDemographics,
      media_with_insights: mediaWithInsights,
      ...avgs,
      engagement_rate,
      updated_at: new Date(),
    });

    console.log("✅ Instagram connected for influencer:", influencerId);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    console.log("🔀 Redirecting to frontend...");
    
    return res.redirect(
      `${frontendUrl}/creator/profile?instagram=connected`
    );
  } catch (err) {
    console.log("❌ Instagram callback error:", {
      message: err.message,
      code: err.code,
      response_data: err.response?.data
    });
    
    const frontendUrl = process.env.FRONTEND_URL || "https://fluencerz.com";
    return res.redirect(
      `${frontendUrl}/creator/profile?instagram=error&message=${encodeURIComponent(err.message)}`
    );
  }
};

// Helper function to process demographic data
function processDemographicData(rawDemographics) {
  const processed = {
    gender: null,
    age: null,
    country: null,
    city: null,
    raw_data: rawDemographics
  };

  try {
    // Process gender data from various endpoints
    const genderSources = [
      'follower_demographics_gender',
      'engaged_audience_demographics_gender', 
      'reached_audience_demographics_gender'
    ];

    for (const source of genderSources) {
      if (rawDemographics[source]?.data?.[0]?.values?.[0]?.value) {
        const genderData = {};
        const genderValues = rawDemographics[source].data[0].values[0].value;
        
        genderValues.forEach(item => {
          if (item.gender && item.percentage) {
            genderData[item.gender.toLowerCase()] = Number(item.percentage.toFixed(2));
          }
        });

        if (Object.keys(genderData).length > 0) {
          processed.gender = genderData;
          console.log(`✅ Found gender data in ${source}:`, genderData);
          break; // Use first valid source
        }
      }
    }

    // Process country data from various endpoints
    const countrySources = [
      'follower_demographics_country',
      'engaged_audience_demographics_country',
      'reached_audience_demographics_country'
    ];

    for (const source of countrySources) {
      if (rawDemographics[source]?.data?.[0]?.values?.[0]?.value) {
        const countryData = {};
        const countryValues = rawDemographics[source].data[0].values[0].value;
        
        countryValues.forEach(item => {
          if (item.country && item.percentage) {
            countryData[item.country] = Number(item.percentage.toFixed(2));
          }
        });

        if (Object.keys(countryData).length > 0) {
          processed.country = countryData;
          console.log(`✅ Found country data in ${source} with ${Object.keys(countryData).length} countries`);
          break; // Use first valid source
        }
      }
    }

  } catch (error) {
    console.log("❌ Error processing demographic data:", error.message);
  }

  return processed;
}

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
        params = {};
        attempt = 0;
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
        account_insights_lifetime: account.account_insights_lifetime,
        audience_demographics: account.audience_demographics,
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