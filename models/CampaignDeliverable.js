module.exports = (sequelize, DataTypes) => {
    const CampaignDeliverable = sequelize.define('CampaignDeliverable', {
      campaign_id: { type: DataTypes.BIGINT, allowNull: false },
      influencer_id: { type: DataTypes.BIGINT, allowNull: false },
      platform: { type: DataTypes.ENUM('Instagram','YouTube','TikTok','Other'), allowNull: false },
      media_type: { type: DataTypes.ENUM('POST','REEL','STORY','VIDEO','CAROUSEL','OTHER'), allowNull: false },
      // IG post permalink or YT video URL, etc.
      permalink: { type: DataTypes.TEXT, allowNull: true },
  
      // Optional upload proof (image/pdf/zip). Store public path.
      proof_file: { type: DataTypes.STRING, allowNull: true },
  
      // One thumbnail or cover image to render in report
      cover_image: { type: DataTypes.STRING, allowNull: true },
  
      // Flexible metrics container — you will validate shape server-side.
      // e.g. { reach, impressions, likes, comments, saves, shares, views, profile_visits }
      metrics: { type: DataTypes.JSON, allowNull: true },
  
      // Optional UTM / tracking info for sales/traffic attribution
      tracking: { type: DataTypes.JSON, allowNull: true },
  
      // Optional hashtags or tag list to match the brief
      tags: { type: DataTypes.JSON, allowNull: true }, // ["#LightUpWithUs", "@brand"]
  
      notes: { type: DataTypes.TEXT, allowNull: true },
  
      // Workflow
      status: { type: DataTypes.ENUM('submitted','needs_changes','approved','rejected'), defaultValue: 'submitted' },
  
      submitted_at: { type: DataTypes.DATE, defaultValue: sequelize.literal('CURRENT_TIMESTAMP') },
      reviewed_at: { type: DataTypes.DATE },
    }, {
      tableName: 'CampaignDeliverables',
      underscored: true,
    });
  
    CampaignDeliverable.associate = (models) => {
      CampaignDeliverable.belongsTo(models.Campaign, { foreignKey: 'campaign_id' });
      CampaignDeliverable.belongsTo(models.Influencer, { foreignKey: 'influencer_id' });
      CampaignDeliverable.hasMany(models.DeliverableComment, { foreignKey: 'deliverable_id' });
    };
  
    return CampaignDeliverable;
  };