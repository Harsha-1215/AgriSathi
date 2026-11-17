const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('ContactMessage', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING(160), allowNull: false },
  email: { type: DataTypes.STRING(254), allowNull: false },
  mobile: { type: DataTypes.STRING(20), allowNull: true },
  subject: { type: DataTypes.STRING(200), allowNull: false },
  message: { type: DataTypes.STRING(5000), allowNull: false },
  preferredLanguage: { type: DataTypes.ENUM('en', 'te', 'hi'), allowNull: false, defaultValue: 'en' },
  status: { type: DataTypes.ENUM('new', 'read', 'resolved'), allowNull: false, defaultValue: 'new' },
  ipHash: { type: DataTypes.STRING(64), allowNull: true },
}, { tableName: 'contact_messages', indexes: [{ fields: ['status', 'createdAt'] }, { fields: ['email'] }] });
