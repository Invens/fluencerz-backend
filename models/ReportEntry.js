// models/report_entry.js
module.exports = (sequelize, DataTypes) => {
  const ReportEntry = sequelize.define('ReportEntry', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    thread_id: { type: DataTypes.INTEGER, allowNull: false },
    parent_entry_id: { type: DataTypes.INTEGER, allowNull: true },
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    submitted_by_role: { type: DataTypes.ENUM('influencer','brand'), allowNull: false },
    type: { type: DataTypes.ENUM('manual','instagram'), allowNull: false },
    metrics: {
      type: DataTypes.TEXT('long'),
      allowNull: true,
      get() { const v = this.getDataValue('metrics'); try { return v ? JSON.parse(v) : {}; } catch { return {}; } },
      set(val) { this.setDataValue('metrics', JSON.stringify(val || {})); }
    },
    notes: { type: DataTypes.TEXT, allowNull: true },
    ig_media_id: { type: DataTypes.STRING(64), allowNull: true },
    ig_permalink: { type: DataTypes.TEXT, allowNull: true },
    ig_media_type: { type: DataTypes.STRING(50), allowNull: true },
    ig_thumbnail: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM('submitted','approved','rejected','needs_changes'),
      allowNull: true,
      defaultValue: 'submitted'
    },
    review_note: { type: DataTypes.TEXT, allowNull: true },
    reviewed_by: { type: DataTypes.INTEGER, allowNull: true },
    reviewed_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'report_entries',
    underscored: true,
    timestamps: true
  });

  ReportEntry.associate = models => {
    ReportEntry.belongsTo(models.ReportThread, { foreignKey: 'thread_id' });
    // IMPORTANT: do NOT add belongsTo(models.Influencer) here (no influencer_id column)
  };

  return ReportEntry;
};
