// models/report_thread.js
module.exports = (sequelize, DataTypes) => {
    const ReportThread = sequelize.define('ReportThread', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      campaign_id: { type: DataTypes.BIGINT, allowNull: false },
      brand_id: { type: DataTypes.INTEGER, allowNull: false },
      influencer_id: { type: DataTypes.INTEGER, allowNull: false },
      has_manual: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: 0 },
      has_instagram: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: 0 },
      latest_status: {
        type: DataTypes.ENUM('submitted','approved','rejected','needs_changes'),
        allowNull: true,
        defaultValue: 'submitted'
      },
      latest_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    }, {
      tableName: 'report_threads',
      underscored: true,
      timestamps: true
    });
  
    ReportThread.associate = models => {
      ReportThread.hasMany(models.ReportEntry, { as: 'entries', foreignKey: 'thread_id' });
      ReportThread.belongsTo(models.Campaign, { foreignKey: 'campaign_id' });
      ReportThread.belongsTo(models.Influencer, { foreignKey: 'influencer_id' });
    };
  
    return ReportThread;
  };
  