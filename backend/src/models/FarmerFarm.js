const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('FarmerFarm', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' } },
  farmName: { type: DataTypes.STRING(160), allowNull: false },
  state: { type: DataTypes.STRING(120), allowNull: true },
  district: { type: DataTypes.STRING(120), allowNull: true },
  mandal: { type: DataTypes.STRING(120), allowNull: true },
  village: { type: DataTypes.STRING(120), allowNull: true },
  pinCode: { type: DataTypes.STRING(10), allowNull: true },
  latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  landArea: { type: DataTypes.DECIMAL(16, 4), allowNull: false },
  areaUnit: { type: DataTypes.STRING(40), allowNull: false },
  soilType: { type: DataTypes.STRING(120), allowNull: true },
  irrigationType: { type: DataTypes.STRING(120), allowNull: true },
  waterSource: { type: DataTypes.STRING(120), allowNull: true },
  mainCrops: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  boundaryCoordinates: { type: DataTypes.JSONB, allowNull: true },
}, {
  tableName: 'farmer_farms',
  indexes: [{ fields: ['userId', 'createdAt'] }, { fields: ['userId', 'district'] }],
});
