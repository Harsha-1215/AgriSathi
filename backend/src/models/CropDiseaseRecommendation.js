const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('CropDiseaseRecommendation', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  diseaseId: { type: DataTypes.UUID, allowNull: false, references: { model: 'crop_diseases', key: 'id' } },
  category: { type: DataTypes.ENUM('cultural', 'sanitation', 'monitoring', 'integrated_pest_management', 'chemical_label_guidance'), allowNull: false },
  description: { type: DataTypes.STRING(1500), allowNull: false },
  source: { type: DataTypes.STRING(1000), allowNull: true },
  language: { type: DataTypes.ENUM('en', 'te', 'hi'), allowNull: false, defaultValue: 'en' },
  isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { tableName: 'crop_disease_recommendations', indexes: [{ fields: ['diseaseId', 'isPublished', 'language'] }] });
