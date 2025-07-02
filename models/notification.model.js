module.exports = (sequelize, DataTypes) => {
  return sequelize.define(
    'Notification',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      user_type: {
        type: DataTypes.ENUM('brand', 'influencer'),
        allowNull: false
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      message: {
        type: DataTypes.STRING,
        allowNull: false
      },
      is_read: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      }
    },
    {
      tableName: 'notifications',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false
    }
  );
};
