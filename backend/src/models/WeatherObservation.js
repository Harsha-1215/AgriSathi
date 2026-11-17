const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('WeatherObservation', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  locationHash: { type: DataTypes.STRING(64), allowNull: false },
  locationName: { type: DataTypes.STRING(180), allowNull: true },
  latitude: { type: DataTypes.DECIMAL(9, 6), allowNull: false },
  longitude: { type: DataTypes.DECIMAL(9, 6), allowNull: false },
  observedAt: { type: DataTypes.DATE, allowNull: false },
  provider: { type: DataTypes.STRING(80), allowNull: false },
  data: { type: DataTypes.JSONB, allowNull: false },
}, {
  tableName: 'weather_observations',
  indexes: [{ unique: true, fields: ['locationHash', 'provider', 'observedAt'] }],
});
