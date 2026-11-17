const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('WeatherNotificationPreference', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  rainfallAlerts: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  windAlerts: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  temperatureAlerts: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  severeWeatherAlerts: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'weather_notification_preferences' });
