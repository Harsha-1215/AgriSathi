const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('FarmerWeatherLocation', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.STRING(255), allowNull: false },
  locationName: { type: DataTypes.STRING(180), allowNull: false },
  village: { type: DataTypes.STRING(120), allowNull: true },
  mandal: { type: DataTypes.STRING(120), allowNull: true },
  district: { type: DataTypes.STRING(120), allowNull: true },
  state: { type: DataTypes.STRING(120), allowNull: true },
  latitude: { type: DataTypes.DECIMAL(9, 6), allowNull: false },
  longitude: { type: DataTypes.DECIMAL(9, 6), allowNull: false },
  isDefault: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: 'farmer_weather_locations',
  indexes: [{ fields: ['userId', 'isDefault'] }],
});
