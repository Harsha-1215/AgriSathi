const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('WeatherAlert', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  providerAlertId: { type: DataTypes.STRING(255), allowNull: true, unique: true },
  location: { type: DataTypes.STRING(180), allowNull: false },
  alertType: { type: DataTypes.STRING(100), allowNull: false },
  severity: { type: DataTypes.STRING(50), allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: false },
  startTime: { type: DataTypes.DATE, allowNull: true },
  endTime: { type: DataTypes.DATE, allowNull: true },
  source: { type: DataTypes.STRING(300), allowNull: false },
  lastUpdatedAt: { type: DataTypes.DATE, allowNull: false },
}, {
  tableName: 'weather_alerts',
  indexes: [{ fields: ['location', 'lastUpdatedAt'] }],
});
