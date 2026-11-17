const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('NewsletterSubscriber', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  email: { type: DataTypes.STRING(254), allowNull: false, unique: true },
  preferredLanguage: { type: DataTypes.ENUM('en', 'te', 'hi'), allowNull: false, defaultValue: 'en' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  consentAt: { type: DataTypes.DATE, allowNull: false },
  unsubscribeTokenHash: { type: DataTypes.STRING(64), allowNull: false },
}, { tableName: 'newsletter_subscribers', indexes: [{ fields: ['isActive'] }] });
