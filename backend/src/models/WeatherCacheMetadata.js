const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('WeatherCacheMetadata', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  cacheKey: { type: DataTypes.STRING(128), allowNull: false, unique: true },
  provider: { type: DataTypes.STRING(80), allowNull: false },
  dataType: { type: DataTypes.STRING(40), allowNull: false },
  payload: { type: DataTypes.JSONB, allowNull: false },
  providerUpdatedAt: { type: DataTypes.DATE, allowNull: true },
  fetchedAt: { type: DataTypes.DATE, allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
}, {
  tableName: 'weather_cache_metadata',
  indexes: [{ fields: ['expiresAt'] }],
});
