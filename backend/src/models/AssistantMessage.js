const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('AssistantMessage', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  conversationId: { type: DataTypes.UUID, allowNull: false },
  role: { type: DataTypes.ENUM('user', 'assistant'), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  audioUrl: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'assistant_messages',
  indexes: [{ fields: ['conversationId', 'createdAt'] }],
});
