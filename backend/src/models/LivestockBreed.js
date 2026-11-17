const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('LivestockBreed', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  categoryId: { type: DataTypes.UUID, allowNull: false },
  slug: { type: DataTypes.STRING(100), allowNull: false },
  name: { type: DataTypes.STRING(160), allowNull: false },
  translations: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'livestock_breeds', indexes: [{ unique: true, fields: ['categoryId', 'slug'] }, { fields: ['categoryId', 'isActive'] }] });
