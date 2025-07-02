module.exports = (sequelize, DataTypes) => {
    const Campaign = sequelize.define('campaigns', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      collab_request_id: { type: DataTypes.INTEGER, unique: true }, // ✅ Add unique constraint explicitly
      campaign_status: {
        type: DataTypes.ENUM('in_progress', 'completed', 'cancelled'),
        defaultValue: 'in_progress'
      },
      quotation_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      },
      deliverables: DataTypes.TEXT,
      start_date: DataTypes.DATE,
      end_date: DataTypes.DATE,
      performance_metrics: DataTypes.JSON,
    },
    { 
      tableName: 'campaigns',
      timestamps: true,
      createdAt: 'created_at',     
      updatedAt: 'updated_at'     
    });
  
    return Campaign;
  };
  