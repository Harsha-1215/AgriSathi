const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('AssistantUsageLog', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.STRING(255), allowNull: false },
  provider: { type: DataTypes.STRING(60), allowNull: false },
  requestType: { type: DataTypes.STRING(30), allowNull: false },
  status: { type: DataTypes.STRING(20), allowNull: false },
  inputTokens: { type: DataTypes.INTEGER, allowNull: true },
  outputTokens: { type: DataTypes.INTEGER, allowNull: true },
}, { tableName: 'assistant_usage_logs', indexes: [{ fields: ['userId', 'createdAt'] }] });
