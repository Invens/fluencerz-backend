module.exports = (sequelize, DataTypes) => {
    const CampaignMessage = sequelize.define('CampaignMessage', {
      sender_type: {
        type: DataTypes.ENUM('brand', 'influencer', 'admin'),
      },
      sender_id: {
        type: DataTypes.BIGINT,
      },
      receiver_id: {
        type: DataTypes.BIGINT,
      },
      campaign_id: {
        type: DataTypes.BIGINT,
      },
      message: DataTypes.TEXT,
      is_approved: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
    }, {
      tableName: 'CampaignMessages',
      timestamps: false,          // ✅ no automatic createdAt/updatedAt
      underscored: true,
      createdAt: false,           // ✅ disable alias
      updatedAt: false,           // ✅ disable alias
    });
  
    CampaignMessage.associate = (models) => {
      CampaignMessage.belongsTo(models.Campaign, { foreignKey: 'campaign_id' });
    };
  
    return CampaignMessage;
  };
  