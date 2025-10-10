module.exports = (sequelize, DataTypes) => {
    const ReportComment = sequelize.define('ReportComment', {
      id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      thread_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      author_role: { type: DataTypes.ENUM('brand','influencer','admin'), allowNull: false },
      author_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      text: { type: DataTypes.TEXT, allowNull: false },
    }, {
      tableName: 'report_comments',
      underscored: true,
    });
  
    ReportComment.associate = models => {
      ReportComment.belongsTo(models.ReportThread, { foreignKey: 'thread_id' });
    };
  
    return ReportComment;
  };
  