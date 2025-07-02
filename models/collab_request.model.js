module.exports = (sequelize, DataTypes) => {
    const CollabRequest = sequelize.define('collab_requests', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      brand_id: DataTypes.INTEGER,
      influencer_id: DataTypes.INTEGER,
      status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending' },
      request_message: DataTypes.TEXT,
      admin_response: DataTypes.TEXT,
    },
    {
      tableName: 'collab_requests',
      timestamps: false,
    }
  );
  
    return CollabRequest;
  };
  