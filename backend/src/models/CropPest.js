const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('CropPest', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  cropId: { type: DataTypes.STRING(80), allowNull: false },
  name: { type: DataTypes.STRING(180), allowNull: false },
  scientificName: { type: DataTypes.STRING(180), allowNull: true },
  language: { type: DataTypes.STRING(2), allowNull: false, defaultValue: 'en' },
  description: { type: DataTypes.TEXT, allowNull: true },
  symptoms: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  prevention: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  management: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  source: { type: DataTypes.STRING(1000), allowNull: true },
  verifiedBy: { type: DataTypes.STRING(120), allowNull: true },
  verifiedAt: { type: DataTypes.DATE, allowNull: true },
  isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: 'crop_pests',
  indexes: [{ fields: ['cropId', 'language', 'isPublished'] }],
});
