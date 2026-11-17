const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('CommodityCategory', {
  id: { type: DataTypes.STRING(80), primaryKey: true },
  name: { type: DataTypes.STRING(120), allowNull: false, unique: true },
  translations: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'commodity_categories' });
