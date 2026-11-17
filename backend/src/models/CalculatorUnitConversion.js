const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('CalculatorUnitConversion', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  fromUnit: { type: DataTypes.STRING(40), allowNull: false },
  toUnit: { type: DataTypes.STRING(40), allowNull: false },
  factor: { type: DataTypes.DECIMAL(24, 12), allowNull: false },
  source: { type: DataTypes.STRING(500), allowNull: false },
}, {
  tableName: 'calculator_unit_conversions',
  indexes: [{ unique: true, fields: ['fromUnit', 'toUnit'] }],
});
