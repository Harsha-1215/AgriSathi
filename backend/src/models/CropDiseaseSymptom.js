const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('CropDiseaseSymptom', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  diseaseId: { type: DataTypes.UUID, allowNull: false, references: { model: 'crop_diseases', key: 'id' } },
  description: { type: DataTypes.STRING(500), allowNull: false },
  language: { type: DataTypes.ENUM('en', 'te', 'hi'), allowNull: false, defaultValue: 'en' },
}, { tableName: 'crop_disease_symptoms', indexes: [{ fields: ['diseaseId', 'language'] }] });
