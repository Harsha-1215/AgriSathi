const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('RefreshToken', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' } },
  tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  revokedAt: { type: DataTypes.DATE, allowNull: true },
  replacedById: { type: DataTypes.UUID, allowNull: true },
}, { tableName: 'refresh_tokens', indexes: [{ fields: ['userId', 'expiresAt'] }] });
