const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('PasswordReset', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' } },
  tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  consumedAt: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'password_resets', indexes: [{ fields: ['userId', 'expiresAt'] }] });
