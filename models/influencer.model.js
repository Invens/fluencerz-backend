module.exports = (sequelize, DataTypes) => {
  return sequelize.define('Influencer', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    full_name: DataTypes.STRING,
    email: { type: DataTypes.STRING, unique: true },
    phone: DataTypes.STRING,
    skype: DataTypes.STRING,
    password_hash: DataTypes.STRING,
    profile_image: DataTypes.STRING,
    niche: DataTypes.STRING,
    followers_count: DataTypes.INTEGER,
    engagement_rate: DataTypes.FLOAT,
    social_platforms: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    followers_by_country: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    audience_age_group: DataTypes.STRING,
    audience_gender: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: { male: 0, female: 0, other: 0 }
    },
    total_reach: DataTypes.INTEGER,
    portfolio: DataTypes.TEXT,
    availability: {
      type: DataTypes.ENUM('available', 'unavailable'),
      defaultValue: 'available'
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE
  }, {
    tableName: 'influencers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });
};