const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('CropDiagnosisFeedback', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  diagnosisId: { type: DataTypes.UUID, allowNull: false, references: { model: 'crop_diagnoses', key: 'id' } },
  userId: { type: DataTypes.STRING(255), allowNull: false },
  category: { type: DataTypes.ENUM('incorrect_analysis', 'incorrect_crop', 'missing_symptoms', 'unclear_recommendations', 'helpful'), allowNull: false },
  comment: { type: DataTypes.STRING(1500), allowNull: true },
}, { tableName: 'crop_diagnosis_feedback', indexes: [{ unique: true, fields: ['diagnosisId', 'userId'] }] });
