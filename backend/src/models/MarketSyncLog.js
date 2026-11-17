const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('MarketSyncLog', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  sourceId: { type: DataTypes.UUID, allowNull: false },
  status: { type: DataTypes.STRING(24), allowNull: false },
  startedAt: { type: DataTypes.DATE, allowNull: false },
  completedAt: { type: DataTypes.DATE, allowNull: true },
  recordsFetched: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  recordsStored: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  errors: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
}, {
  tableName: 'market_sync_logs',
  indexes: [{ fields: ['sourceId', 'startedAt'] }],
});
