// models/DeliverableComment.js
module.exports = (sequelize, DataTypes) => {
    const DeliverableComment = sequelize.define('DeliverableComment', {
      deliverable_id: { type: DataTypes.BIGINT, allowNull: false },
      author_role: { type: DataTypes.ENUM('influencer','brand','admin'), allowNull: false },
      author_id: { type: DataTypes.BIGINT, allowNull: false },
      comment: { type: DataTypes.TEXT, allowNull: false },
    }, {
      tableName: 'DeliverableComments',
      underscored: true,
    });
  
    DeliverableComment.associate = (models) => {
      DeliverableComment.belongsTo(models.CampaignDeliverable, { foreignKey: 'deliverable_id' });
    };
  
    return DeliverableComment;
  };