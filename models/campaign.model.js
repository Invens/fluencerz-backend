module.exports = (sequelize, DataTypes) => {
  const Campaign = sequelize.define('Campaign', {
    brand_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    title: DataTypes.STRING,
    description: DataTypes.TEXT,
    brief_link: DataTypes.TEXT,
    media_kit_link: DataTypes.TEXT,
    platform: {
      type: DataTypes.ENUM('Instagram', 'YouTube', 'Twitter', 'Telegram', 'Other'),
    },
    // Add to the attributes
budget: {
  type: DataTypes.DECIMAL(10, 2),
  allowNull: true,
},
    content_type: {
      type: DataTypes.ENUM(
        "Paid per post",
        "Other",
        "Reel",
        "Story",
        "Post",
        "Video"
      ),
    },    
    eligibility_criteria: {
      type: DataTypes.JSON,
    },
    campaign_requirements: {
      type: DataTypes.JSON,
    },
    guidelines_do: {
      type: DataTypes.JSON,
    },
    guidelines_donot: {
      type: DataTypes.JSON,
    },
    feature_image: DataTypes.STRING,
    status: {
      type: DataTypes.ENUM('draft', 'published', 'closed'),
      defaultValue: 'draft',
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      onUpdate: sequelize.literal('CURRENT_TIMESTAMP'),
    }
  }, {
    tableName: 'Campaigns',
    timestamps: false,
    underscored: true,
  });

  Campaign.associate = (models) => {
    Campaign.belongsTo(models.Brand, { foreignKey: 'brand_id' });
    Campaign.hasMany(models.CampaignApplication, { foreignKey: 'campaign_id' });
    Campaign.hasMany(models.CampaignMessage, { foreignKey: 'campaign_id' });
    Campaign.hasMany(models.CampaignMediaFile, { foreignKey: 'campaign_id' });
  };

  return Campaign;
};
