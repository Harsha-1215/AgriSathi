const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('RegionalLandUnitConversion', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  unitCode: { type: DataTypes.STRING(40), allowNull: false },
  region: { type: DataTypes.STRING(120), allowNull: false },
  squareMeters: { type: DataTypes.DECIMAL(20, 8), allowNull: false },
  source: { type: DataTypes.STRING(1000), allowNull: false },
  verifiedBy: { type: DataTypes.STRING(120), allowNull: false },
  verifiedAt: { type: DataTypes.DATE, allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'regional_land_unit_conversions',
  indexes: [{ unique: true, fields: ['unitCode', 'region'] }],
});
