const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('AssistantConversation', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.STRING(255), allowNull: false },
  title: { type: DataTypes.STRING(180), allowNull: false, defaultValue: 'New conversation' },
  language: { type: DataTypes.ENUM('en', 'te', 'hi'), allowNull: false, defaultValue: 'en' },
}, {
  tableName: 'assistant_conversations',
  indexes: [{ fields: ['userId', 'updatedAt'] }],
});
