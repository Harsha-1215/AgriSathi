const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('CalculatorHistory', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.STRING(120), allowNull: false },
  calculatorType: {
    type: DataTypes.ENUM('seed', 'fertilizer', 'pesticide', 'irrigation', 'spacing', 'yield', 'expenses', 'profit-loss', 'loan'),
    allowNull: false,
  },
  formulaVersion: { type: DataTypes.STRING(32), allowNull: false, defaultValue: '1' },
  cropId: { type: DataTypes.STRING(80), allowNull: true },
  title: { type: DataTypes.STRING(160), allowNull: false },
  inputs: { type: DataTypes.JSONB, allowNull: false },
  result: { type: DataTypes.JSONB, allowNull: false },
}, {
  tableName: 'calculator_history',
  indexes: [{ fields: ['userId', 'createdAt'] }, { fields: ['userId', 'calculatorType'] }],
});
