// models/influencer.model.js
module.exports = (sequelize, DataTypes) => {
  const Influencer = sequelize.define(
    "Influencer",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

      // 🔗 Link to unified Users table
      auth_user_id: { type: DataTypes.INTEGER, allowNull: true },

      // Core identity
      full_name: DataTypes.STRING,
      email: { type: DataTypes.STRING, unique: true },
      phone: DataTypes.STRING,
      skype: DataTypes.STRING,
      password_hash: DataTypes.STRING,

      // Profile media (keep both to avoid breaking existing code paths)
      profile_image: DataTypes.STRING,
      profile_picture: DataTypes.STRING,

      // Niche & metrics
      niche: DataTypes.STRING,
      followers_count: DataTypes.INTEGER,
      engagement_rate: DataTypes.FLOAT,
      total_reach: DataTypes.INTEGER,

      // Audience & socials
      social_platforms: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },       // [{ platform, followers }]
      followers_by_country: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },   // [{ country, percentage }]
      audience_age_group: DataTypes.STRING,                                                // e.g., "18-24"
      audience_gender: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: { male: 0, female: 0, other: 0 },
      },

      // Extra profile fields for onboarding
      country: DataTypes.STRING,
      categories: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },             // ["Fashion","Tech",...]
      communication_channel: { type: DataTypes.JSON, allowNull: true, defaultValue: {} },  // { whatsapp:{...}, telegram:{...}, linkedin:{...} }

      // Portfolio & availability
      portfolio: DataTypes.TEXT,
      availability: {
        type: DataTypes.ENUM("available", "unavailable"),
        defaultValue: "available",
      },

      // Onboarding flag
      is_onboarded: { type: DataTypes.BOOLEAN, defaultValue: false },

      // ========== NEW FIELDS FOR REFLUENCED DATA IMPORT ==========
      refluenced_raw_data: { 
        type: DataTypes.JSON, 
        allowNull: true, 
        defaultValue: {} 
      },
      instagram_posts: { 
        type: DataTypes.JSON, 
        allowNull: true, 
        defaultValue: [] 
      },
      performance_metrics: { 
        type: DataTypes.JSON, 
        allowNull: true, 
        defaultValue: {} 
      },
      audience_analytics: { 
        type: DataTypes.JSON, 
        allowNull: true, 
        defaultValue: {} 
      },
      original_uuid: { 
        type: DataTypes.STRING, 
        allowNull: true 
      },

      // Timestamps
      created_at: DataTypes.DATE,
      updated_at: DataTypes.DATE,
    },
    {
      tableName: "influencers",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          fields: ['original_uuid']
        },
        {
          fields: ['full_name']
        },
        {
          fields: ['email']
        }
      ]
    }
  );

  // Associations
  Influencer.associate = function(models) {
    Influencer.hasMany(models.CampaignApplication, {
      foreignKey: 'influencer_id',
      as: 'applications'
    });
    
    Influencer.hasMany(models.CollabRequest, {
      foreignKey: 'influencer_id',
      as: 'collabRequests'
    });
    
    Influencer.hasOne(models.InfluencerInstagramAccount, {
      foreignKey: 'influencer_id',
      as: 'instagramAccount'
    });
  };

  return Influencer;
};