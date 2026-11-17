const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('CalculatorReferenceValue', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  cropId: { type: DataTypes.STRING(80), allowNull: false },
  calculatorType: { type: DataTypes.STRING(32), allowNull: false },
  state: { type: DataTypes.STRING(120), allowNull: true },
  soilType: { type: DataTypes.STRING(120), allowNull: true },
  season: { type: DataTypes.STRING(80), allowNull: true },
  value: { type: DataTypes.JSONB, allowNull: false },
  source: { type: DataTypes.STRING(1000), allowNull: false },
  verifiedBy: { type: DataTypes.STRING(120), allowNull: false },
  verifiedAt: { type: DataTypes.DATE, allowNull: false },
  isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: 'calculator_reference_values',
  indexes: [
    { name: 'calculator_reference_crop_type_published_idx', fields: ['cropId', 'calculatorType', 'isPublished'] },
    { fields: ['state', 'season'] },
  ],
});
