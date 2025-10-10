const { asNum } = require('./util.normalize');

exports.mapInstrackToInstagramBlock = (p) => {
  const ig = {
    platform: 'instagram',
    username: (p.username || '').trim(),
    external_id: String(p.id || '').trim() || null,
    profile_picture_url: p.profile_picture_url || null,
    website: p.website || null,
    bio: p.biography || null,

    followers: asNum(p.followers_count),
    follows: asNum(p.follows_count),
    media: asNum(p.media_count),

    kpi: {
      average_likes: asNum(p.average_likes),
      average_comments: asNum(p.average_comments),
      weekly_posts: asNum(p.weekly_posts),
      engagement_rate: asNum(p.engagement_rate),
      comments_to_likes_ratio: asNum(p.comments_to_likes_ratio),
      followers_to_follows_ratio: asNum(p.followers_to_follows_ratio),
    },

    timeline: Array.isArray(p.profile_history_points)
      ? p.profile_history_points.map(h => ({
          date: h.date,
          followers: asNum(h.followers_count),
          follows: asNum(h.follows_count),
          media: asNum(h.media_count),
          engagement_rate: asNum(h.engagement_rate),
          average_likes: asNum(h.average_likes),
          average_comments: asNum(h.average_comments),
          weekly_posts: asNum(h.weekly_posts),
        }))
      : [],

    analytics: {
      growth_stats: p.growth_stats || null,
      similar_accounts_stats: p.similar_accounts_stats || null,
      score: p.score || null,
    },

    tracked_since: p.tracked_since || null,
    updated_at_remote: p.updated_at || null,
    is_favorite: !!p.is_favorite,
    last_synced_at: new Date().toISOString(),
  };

  if (Array.isArray(ig.timeline) && ig.timeline.length > 90) {
    ig.timeline = ig.timeline.slice(-90);
  }

  return ig;
};
