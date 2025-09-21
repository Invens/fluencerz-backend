module.exports = (sequelize, DataTypes) => {
    const CampaignMediaFile = sequelize.define('CampaignMediaFile', {
      uploader_type: {
        type: DataTypes.ENUM('brand', 'influencer', 'admin'),
      },
      uploader_id: {
        type: DataTypes.BIGINT,
      },
      campaign_id: {
        type: DataTypes.BIGINT,
      },
      file_path: DataTypes.TEXT,
      file_type: DataTypes.STRING,
      visibility: {
        type: DataTypes.ENUM('brand', 'influencer', 'both'),
        defaultValue: 'both',
      },
      is_approved: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      uploaded_at: {
        type: DataTypes.DATE,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      }
    }, {
      tableName: 'CampaignMediaFiles',
      timestamps: false,
      underscored: true,
    });
  
    CampaignMediaFile.associate = (models) => {
      CampaignMediaFile.belongsTo(models.Campaign, { foreignKey: 'campaign_id' });
    };
  
    return CampaignMediaFile;
  };
  