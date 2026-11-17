const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('AgriculturalRecommendation', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  cropId: { type: DataTypes.STRING(80), allowNull: false },
  recommendationType: {
    type: DataTypes.ENUM('seed', 'fertilizer', 'irrigation', 'spacing', 'yield'),
    allowNull: false,
  },
  state: { type: DataTypes.STRING(120), allowNull: true },
  details: { type: DataTypes.JSONB, allowNull: false },
  source: { type: DataTypes.STRING(1000), allowNull: false },
  verifiedBy: { type: DataTypes.STRING(120), allowNull: false },
  verifiedAt: { type: DataTypes.DATE, allowNull: false },
  isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: 'agricultural_recommendations',
  indexes: [{
    name: 'agricultural_recommendations_crop_id_recommendation_type_state_',
    fields: ['cropId', 'recommendationType', 'state', 'isPublished'],
  }],
});
