const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('CropCategory', {
  id: { type: DataTypes.STRING(60), primaryKey: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  translations: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  description: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
}, { tableName: 'crop_categories' });
