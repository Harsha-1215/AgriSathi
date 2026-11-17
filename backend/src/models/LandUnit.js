const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('LandUnit', {
  code: { type: DataTypes.STRING(40), primaryKey: true },
  label: { type: DataTypes.STRING(100), allowNull: false },
  squareMeters: { type: DataTypes.DECIMAL(20, 8), allowNull: true },
  isRegionDependent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'land_units', timestamps: true });
