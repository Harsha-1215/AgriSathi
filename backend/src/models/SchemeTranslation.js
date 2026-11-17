const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('SchemeTranslation', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  schemeId: { type: DataTypes.UUID, allowNull: false },
  language: { type: DataTypes.ENUM('te', 'hi'), allowNull: false },
  translatedName: { type: DataTypes.STRING(240), allowNull: false },
  translatedDescription: { type: DataTypes.TEXT, allowNull: false },
  translatedEligibility: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  translatedBenefits: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  translatedProcedure: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  source: { type: DataTypes.STRING(1000), allowNull: false },
  verifiedBy: { type: DataTypes.STRING(120), allowNull: false },
  verifiedAt: { type: DataTypes.DATE, allowNull: false },
}, {
  tableName: 'scheme_translations',
  indexes: [{ unique: true, fields: ['schemeId', 'language'] }],
});
