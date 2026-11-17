const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('UserSession', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' } },
  refreshTokenId: { type: DataTypes.UUID, allowNull: false, unique: true, references: { model: 'refresh_tokens', key: 'id' } },
  userAgent: { type: DataTypes.STRING(500), allowNull: true },
  ipHash: { type: DataTypes.STRING(64), allowNull: true },
  lastSeenAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { tableName: 'user_sessions', indexes: [{ fields: ['userId', 'lastSeenAt'] }] });
