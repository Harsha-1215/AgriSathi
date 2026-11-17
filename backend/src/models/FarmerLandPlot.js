const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('FarmerLandPlot', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.STRING(255), allowNull: false },
  plotName: { type: DataTypes.STRING(120), allowNull: false },
  measurementMethod: { type: DataTypes.ENUM('gps', 'map', 'manual'), allowNull: false },
  areaSquareMeters: { type: DataTypes.DECIMAL(18, 6), allowNull: false },
  areaAcres: { type: DataTypes.DECIMAL(18, 8), allowNull: false },
  areaCents: { type: DataTypes.DECIMAL(18, 8), allowNull: false },
  areaHectares: { type: DataTypes.DECIMAL(18, 10), allowNull: false },
  boundaryCoordinates: { type: DataTypes.JSONB, allowNull: true },
  centerLatitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  centerLongitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  gpsAccuracy: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  notes: { type: DataTypes.STRING(2000), allowNull: true },
}, {
  tableName: 'farmer_land_plots',
  indexes: [
    { fields: ['userId', 'updatedAt'] },
    { fields: ['userId', 'areaSquareMeters'] },
  ],
});
