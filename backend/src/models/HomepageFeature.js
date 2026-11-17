const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('HomepageFeature', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING(160), allowNull: false },
  description: { type: DataTypes.STRING(800), allowNull: false },
  iconName: { type: DataTypes.STRING(80), allowNull: true },
  imageUrl: { type: DataTypes.STRING(1200), allowNull: true },
  route: { type: DataTypes.STRING(300), allowNull: true },
  displayOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  translations: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
}, { tableName: 'homepage_features', indexes: [{ fields: ['isActive', 'displayOrder'] }] });
