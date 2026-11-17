const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('CropDiagnosis', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.STRING(255), allowNull: false },
  cropId: { type: DataTypes.STRING(80), allowNull: true },
  cropName: { type: DataTypes.STRING(120), allowNull: false },
  reportedSymptoms: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  imageUrl: { type: DataTypes.TEXT, allowNull: false },
  imagePublicId: { type: DataTypes.STRING(255), allowNull: false },
  imageFormat: { type: DataTypes.STRING(12), allowNull: false },
  possibleDisease: { type: DataTypes.STRING(180), allowNull: true },
  possibleConditions: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  observedSymptoms: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  limitations: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  severity: { type: DataTypes.ENUM('low', 'moderate', 'high'), allowNull: true },
  confidenceScore: { type: DataTypes.DECIMAL(5, 4), allowNull: true },
  aiExplanation: { type: DataTypes.TEXT, allowNull: true },
  recommendations: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  analysisStatus: {
    type: DataTypes.ENUM('possible_issue', 'image_unclear', 'no_reliable_match', 'healthy_looking', 'analysis_unavailable'),
    allowNull: false,
  },
  processingStatus: { type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'inconclusive'), allowNull: false, defaultValue: 'completed' },
  provider: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'gemini' },
  modelVersion: { type: DataTypes.STRING(120), allowNull: true },
  externalProcessingConsent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  externalProcessingConsentAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'crop_diagnoses',
  indexes: [{ fields: ['userId', 'createdAt'] }],
});
