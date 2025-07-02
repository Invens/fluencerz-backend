module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Rating', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    campaign_id: { type: DataTypes.INTEGER, allowNull: false },
    rated_by: { type: DataTypes.ENUM('admin', 'brand'), allowNull: false },
    rating_value: { type: DataTypes.INTEGER, allowNull: false },
    review: DataTypes.TEXT
  }, {
    tableName: 'ratings',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
  });
};
