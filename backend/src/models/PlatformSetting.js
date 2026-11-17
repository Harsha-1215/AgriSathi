const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('PlatformSetting', {
  key: { type: DataTypes.STRING(100), primaryKey: true },
  value: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  isPublic: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { tableName: 'platform_settings' });
