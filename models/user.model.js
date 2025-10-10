// models/user.js
module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define("User", {
      firstname: DataTypes.STRING,
      lastname: DataTypes.STRING,
      email: { type: DataTypes.STRING, unique: true },
      phone: DataTypes.STRING,
      password_hash: DataTypes.STRING,
      user_type: DataTypes.ENUM("brand","influencer","admin"),
      is_onboarded: { type: DataTypes.BOOLEAN, defaultValue: false },
    }, {
      tableName: "users",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    });
  
    User.associate = (db) => {
      User.hasOne(db.Brand, { foreignKey: "auth_user_id" });
      User.hasOne(db.Influencer, { foreignKey: "auth_user_id" });
    };
    return User;
  };
  