const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('LivestockCategory', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  slug: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(160), allowNull: false },
  translations: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  icon: { type: DataTypes.STRING(60), allowNull: false, defaultValue: 'beef' },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'livestock_categories' });
