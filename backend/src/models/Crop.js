const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Crop', {
  id: { type: DataTypes.STRING(80), primaryKey: true },
  name: { type: DataTypes.STRING(120), allowNull: false },
  translations: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  categoryId: { type: DataTypes.STRING(60), allowNull: false },
  description: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  growingSeasons: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  imageUrl: { type: DataTypes.STRING(1000), allowNull: true },
  scientificName: { type: DataTypes.STRING(180), allowNull: true },
  source: { type: DataTypes.STRING(1000), allowNull: true },
  verifiedBy: { type: DataTypes.STRING(120), allowNull: true },
  verifiedAt: { type: DataTypes.DATE, allowNull: true },
  isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  isFeatured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'crops',
  indexes: [{ fields: ['categoryId', 'isActive'] }, { fields: ['name'] }],
});
