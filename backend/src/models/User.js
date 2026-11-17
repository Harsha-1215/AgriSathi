const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('User', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  fullName: { type: DataTypes.STRING(160), allowNull: false },
  email: { type: DataTypes.STRING(254), allowNull: true, unique: true },
  mobile: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING(100), allowNull: false },
  status: { type: DataTypes.ENUM('pending_verification', 'active', 'suspended', 'deleted'), allowNull: false, defaultValue: 'pending_verification' },
  isVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  failedLoginAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  lockedUntil: { type: DataTypes.DATE, allowNull: true },
  lastLoginAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'users',
  indexes: [{ fields: ['status', 'isVerified'] }],
});
