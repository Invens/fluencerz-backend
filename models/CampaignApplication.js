module.exports = (sequelize, DataTypes) => {
    const CampaignApplication = sequelize.define('CampaignApplication', {
      influencer_id: {
        type: DataTypes.BIGINT,
      },
      campaign_id: {
        type: DataTypes.BIGINT,
      },
      status: {
        type: DataTypes.ENUM('pending', 'forwarded','brand_approved', 'approved', 'rejected'),
        defaultValue: 'pending'
      },
      applied_at: {
        type: DataTypes.DATE,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      }
    }, {
      tableName: 'CampaignApplications',
      timestamps: false,
      underscored: true,
    });
  
    CampaignApplication.associate = (models) => {
      CampaignApplication.belongsTo(models.Influencer, { foreignKey: 'influencer_id' });
      CampaignApplication.belongsTo(models.Campaign, { foreignKey: 'campaign_id' });
    };
  
    return CampaignApplication;
  };
  