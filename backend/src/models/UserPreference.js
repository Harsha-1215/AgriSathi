const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('UserPreference', {
  userId: { type: DataTypes.UUID, primaryKey: true, references: { model: 'users', key: 'id' } },
  preferredLanguage: { type: DataTypes.ENUM('en', 'te', 'hi'), allowNull: false, defaultValue: 'en' },
  interactionMode: {
    type: DataTypes.STRING(16),
    allowNull: false,
    defaultValue: 'normal',
    validate: { isIn: [['normal', 'voice']] },
  },
  notificationsEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  notificationSettings: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
}, { tableName: 'user_preferences' });
