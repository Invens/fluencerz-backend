module.exports = (sequelize, DataTypes) => {
    const Admin = sequelize.define('admins', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      full_name: DataTypes.STRING,
      email: { type: DataTypes.STRING, unique: true },
      phone: DataTypes.STRING,
      skype: DataTypes.STRING,
      password_hash: DataTypes.STRING,
      role: { type: DataTypes.ENUM('super_admin', 'moderator'), defaultValue: 'super_admin' },
    },
    { 
        tableName: 'admins',
        timestamps: false,
      });

    return Admin;
  };
  