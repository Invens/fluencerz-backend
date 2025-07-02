module.exports = (sequelize, DataTypes) => {
    const Payment = sequelize.define('Payment', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      campaign_id: DataTypes.INTEGER,
      brand_id: DataTypes.INTEGER,
      influencer_id: DataTypes.INTEGER,
      amount: DataTypes.DECIMAL(10, 2),
      payment_status: { type: DataTypes.ENUM('pending', 'completed', 'failed'), defaultValue: 'pending' },
      transaction_id: { type: DataTypes.STRING, unique: true },
    });
  
    return Payment;
  };
  