const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('PlatformAnnouncement', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  title: { type: DataTypes.STRING(200), allowNull: false },
  message: { type: DataTypes.STRING(4000), allowNull: false },
  language: { type: DataTypes.ENUM('en', 'te', 'hi'), allowNull: false, defaultValue: 'en' },
  status: { type: DataTypes.ENUM('draft', 'approved', 'archived'), allowNull: false, defaultValue: 'draft' },
  startsAt: { type: DataTypes.DATE, allowNull: true },
  endsAt: { type: DataTypes.DATE, allowNull: true },
  priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'platform_announcements', indexes: [{ fields: ['status', 'startsAt', 'endsAt'] }] });
