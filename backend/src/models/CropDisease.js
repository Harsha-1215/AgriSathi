const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('CropDisease', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING(180), allowNull: false },
  cropName: { type: DataTypes.STRING(120), allowNull: false },
  scientificName: { type: DataTypes.STRING(180), allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  causes: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  symptoms: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  environmentalConditions: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  prevention: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  managementMethods: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  verifiedTreatmentGuidance: { type: DataTypes.TEXT, allowNull: true },
  source: { type: DataTypes.STRING(500), allowNull: true },
  lastVerifiedAt: { type: DataTypes.DATE, allowNull: true },
  isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: 'crop_diseases',
  indexes: [{ fields: ['cropName', 'name'] }, { fields: ['isPublished', 'cropName'] }],
});
