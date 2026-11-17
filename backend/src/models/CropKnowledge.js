const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('CropKnowledge', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  cropId: { type: DataTypes.STRING(80), allowNull: false },
  sectionType: {
    type: DataTypes.ENUM('overview', 'climate', 'soil', 'land-preparation', 'seed-selection', 'sowing', 'irrigation', 'fertilizer', 'weed', 'pest', 'disease', 'harvesting', 'storage', 'marketing', 'faq'),
    allowNull: false,
  },
  language: { type: DataTypes.ENUM('en', 'te', 'hi'), allowNull: false },
  title: { type: DataTypes.STRING(180), allowNull: false },
  content: { type: DataTypes.JSONB, allowNull: false },
  source: { type: DataTypes.STRING(1000), allowNull: true },
  verifiedBy: { type: DataTypes.STRING(120), allowNull: true },
  verifiedAt: { type: DataTypes.DATE, allowNull: true },
  isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: 'crop_knowledge',
  indexes: [{ fields: ['cropId', 'language', 'isPublished'] }, { fields: ['sectionType', 'isPublished'] }],
});
