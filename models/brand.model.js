// models/brand.model.js
module.exports = (sequelize, DataTypes) => {
  const Brand = sequelize.define(
    "Brand",
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

      // 🔗 Link to unified Users table
      auth_user_id: { type: DataTypes.INTEGER, allowNull: true },

      // Core fields
      company_name: DataTypes.STRING,
      contact_person: DataTypes.STRING,
      email: { type: DataTypes.STRING, unique: true },
      phone: DataTypes.STRING,
      skype: DataTypes.STRING,
      password_hash: DataTypes.STRING,

      // Profile & business details
      industry: DataTypes.STRING,
      website: DataTypes.STRING,
      budget_range: DataTypes.STRING,
      campaign_goal: DataTypes.TEXT,

      // Media (keep both if some code paths use either)
      profile_picture: DataTypes.STRING,
      profile_image: DataTypes.STRING,
      logo_url: DataTypes.STRING,

      // Comms & onboarding
      communication_channel: { type: DataTypes.JSON, allowNull: true },
      is_onboarded: { type: DataTypes.BOOLEAN, defaultValue: false },

      // Timestamps
      created_at: DataTypes.DATE,
      updated_at: DataTypes.DATE,
    },
    {
      tableName: "brands",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  );

  return Brand;
};
