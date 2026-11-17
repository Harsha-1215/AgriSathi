const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Commodity', {
  id: { type: DataTypes.STRING(80), primaryKey: true },
  name: { type: DataTypes.STRING(160), allowNull: false, unique: true },
  localName: { type: DataTypes.STRING(160), allowNull: true },
  translations: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  categoryId: { type: DataTypes.STRING(80), allowNull: true },
  standardUnit: { type: DataTypes.STRING(40), allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'commodities',
  indexes: [{ fields: ['categoryId', 'isActive'] }],
});
