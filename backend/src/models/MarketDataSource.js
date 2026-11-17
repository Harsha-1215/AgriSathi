const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('MarketDataSource', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING(160), allowNull: false },
  provider: { type: DataTypes.STRING(80), allowNull: false },
  baseUrl: { type: DataTypes.STRING(1000), allowNull: true },
  resourceId: { type: DataTypes.STRING(160), allowNull: true },
  sourceUrl: { type: DataTypes.STRING(1000), allowNull: true },
  isAuthorized: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  config: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  lastFetchedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'market_data_sources',
  indexes: [{ fields: ['provider', 'isActive'] }],
});
