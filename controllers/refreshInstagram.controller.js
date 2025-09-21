// controllers/InstagramInsight.controller.js
const axios = require("axios");
const db = require("../models");
const InfluencerInstagramAccount = db.InfluencerInstagramAccount;

async function safeRequest(url, options, label = "API REQUEST") {
  try {
    const res = await axios.get(url, options);
    return res.data;
  } catch (err) {
    throw err.response?.data || err;
  }
}

async function safeRequestWithRetry(url, options, label, maxRetries = 2) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      return await safeRequest(url, options, label);
    } catch (err) {
      attempt++;
      if (attempt > maxRetries) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

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

exports.refreshInstagramData = async (req, res) => {
  try {
    const influencerId = req.user.id;
    const account = await InfluencerInstagramAccount.findOne({
      where: { influencer_id: influencerId },
    });

    if (!account) {
      return res.status(404).json({ message: "Instagram not connected" });
    }

    let accessToken = account.access_token;

    // 🔄 Refresh long-lived token if needed
    const expiresAt = new Date(account.token_expires_at);
    if ((expiresAt - new Date()) / (1000 * 60 * 60 * 24) < 7) {
      const refreshRes = await axios.get(
        "https://graph.instagram.com/refresh_access_token",
        {
          params: {
            grant_type: "ig_refresh_token",
            access_token: accessToken,
          },
        }
      );

      accessToken = refreshRes.data.access_token;
      account.access_token = accessToken;
      account.token_expires_at = new Date(
        Date.now() + refreshRes.data.expires_in * 1000
      );
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
    const dayMetrics = [
      "accounts_engaged",
      "total_interactions",
      "reach",
      "impressions",
      "views",
    ];
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
      {
        name: "engaged_audience_demographics",
        params: { period: "lifetime", breakdown: "gender,country" },
      },
      {
        name: "follower_demographics",
        params: { period: "lifetime", breakdown: "gender,country" },
      },
    ];

    for (const metric of metrics30Config) {
      try {
        insights30Days[metric.name] = await safeRequestWithRetry(
          `https://graph.instagram.com/v23.0/${account.ig_user_id}/insights`,
          {
            params: { ...metric.params, metric: metric.name, access_token: accessToken },
          },
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
      profile.followers_count > 0
        ? ((avgLikes + avgComments) / profile.followers_count) * 100
        : 0;

    // 🔁 Save all updated data
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
      message: "Instagram data fully refreshed & saved",
      data: account,
    });
  } catch (err) {
    console.error("❌ Failed to refresh IG data:", err);
    res.status(500).json({ error: "Failed to refresh IG data" });
  }
};
