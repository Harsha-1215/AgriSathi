const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('AssistantFeedback', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.STRING(255), allowNull: false },
  messageId: { type: DataTypes.UUID, allowNull: false },
  rating: { type: DataTypes.ENUM('helpful', 'not_helpful'), allowNull: false },
  comment: { type: DataTypes.STRING(1000), allowNull: true },
}, {
  tableName: 'assistant_feedback',
  indexes: [{ unique: true, fields: ['userId', 'messageId'] }],
});
