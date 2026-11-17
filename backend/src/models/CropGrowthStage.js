const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('CropGrowthStage', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  cropId: { type: DataTypes.STRING(80), allowNull: false },
  language: { type: DataTypes.ENUM('en', 'te', 'hi'), allowNull: false },
  sequence: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING(160), allowNull: false },
  durationDays: { type: DataTypes.INTEGER, allowNull: true },
  details: { type: DataTypes.JSONB, allowNull: false },
  source: { type: DataTypes.STRING(1000), allowNull: true },
  verifiedBy: { type: DataTypes.STRING(120), allowNull: true },
  verifiedAt: { type: DataTypes.DATE, allowNull: true },
  isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: 'crop_growth_stages',
  indexes: [{ fields: ['cropId', 'language', 'sequence', 'isPublished'] }],
});
