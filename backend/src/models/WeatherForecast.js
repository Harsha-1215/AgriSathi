const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('WeatherForecast', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  locationHash: { type: DataTypes.STRING(64), allowNull: false },
  latitude: { type: DataTypes.DECIMAL(9, 6), allowNull: false },
  longitude: { type: DataTypes.DECIMAL(9, 6), allowNull: false },
  forecastAt: { type: DataTypes.DATE, allowNull: false },
  fetchedAt: { type: DataTypes.DATE, allowNull: false },
  provider: { type: DataTypes.STRING(80), allowNull: false },
  data: { type: DataTypes.JSONB, allowNull: false },
}, {
  tableName: 'weather_forecasts',
  indexes: [{ unique: true, fields: ['locationHash', 'provider', 'forecastAt'] }],
});
