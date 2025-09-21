module.exports = (sequelize, DataTypes) => {
  return sequelize.define("InfluencerInstagramAccount", {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    influencer_id: { type: DataTypes.INTEGER, allowNull: false },
    ig_user_id: { type: DataTypes.BIGINT, allowNull: false, unique: true },
    username: DataTypes.STRING,
    profile_picture_url: DataTypes.TEXT,
    biography: DataTypes.TEXT,
    website: DataTypes.STRING,
    access_token: DataTypes.TEXT,
    token_expires_at: DataTypes.DATE,
    followers_count: DataTypes.INTEGER,
    follows_count: DataTypes.INTEGER,
    media_count: DataTypes.INTEGER,

    // 📊 Performance Metrics
    avg_reach: { type: DataTypes.INTEGER, defaultValue: 0 },
    engagement_rate: { type: DataTypes.FLOAT, defaultValue: 0 },
    avg_views: { type: DataTypes.INTEGER, defaultValue: 0 },
    avg_comments: { type: DataTypes.FLOAT, defaultValue: 0 },
    avg_likes: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_engagements: { type: DataTypes.INTEGER, defaultValue: 0 },

    // 👥 Demographics
    audience_gender: { type: DataTypes.JSON, defaultValue: { male: 0, female: 0, other: 0 } },
    followers_by_country: { type: DataTypes.JSON, defaultValue: [] },
    audience_age_distribution: { type: DataTypes.JSON, defaultValue: [] },
    audience_city: { type: DataTypes.JSON, defaultValue: [] },

    // 📦 Snapshots
      // New fields
      account_insights_day: { type: DataTypes.JSON, defaultValue: {} },
      account_insights_30days: { type: DataTypes.JSON, defaultValue: {} },
      media_with_insights: { type: DataTypes.JSON, defaultValue: [] },
  }, {
    tableName: "influencer_instagram_accounts",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at"
  });
};
