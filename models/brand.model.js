module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Brand', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      company_name: DataTypes.STRING,
      contact_person: DataTypes.STRING,
      email: { type: DataTypes.STRING, unique: true },
      phone: DataTypes.STRING,
      skype: DataTypes.STRING,
      password_hash: DataTypes.STRING,
      profile_picture: DataTypes.STRING,
      industry: DataTypes.STRING,
      website: DataTypes.STRING,
      profile_image: DataTypes.STRING, 
      budget_range: DataTypes.STRING,
      campaign_goal: DataTypes.TEXT
    }, { 
      tableName: 'brands',
      timestamps: true,
      createdAt: 'created_at',     // 👈 Fix here
      updatedAt: 'updated_at'      // 👈 Fix here
    });
  };
  