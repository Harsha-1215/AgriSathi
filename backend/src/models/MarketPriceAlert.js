const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('MarketPriceAlert', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.STRING(255), allowNull: false },
  commodityId: { type: DataTypes.STRING(80), allowNull: false },
  marketId: { type: DataTypes.UUID, allowNull: true },
  condition: { type: DataTypes.STRING(24), allowNull: false },
  targetPrice: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  unit: { type: DataTypes.STRING(40), allowNull: false },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  lastTriggeredAt: { type: DataTypes.DATE, allowNull: true },
  lastTriggeredPriceId: { type: DataTypes.UUID, allowNull: true },
}, {
  tableName: 'market_price_alerts',
  indexes: [{ fields: ['userId', 'isActive'] }, { fields: ['commodityId', 'isActive'] }],
});
