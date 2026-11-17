const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('MarketPrice', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  commodityId: { type: DataTypes.STRING(80), allowNull: false },
  marketId: { type: DataTypes.UUID, allowNull: false },
  arrivalDate: { type: DataTypes.DATEONLY, allowNull: false },
  minimumPrice: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  maximumPrice: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  modalPrice: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  unit: { type: DataTypes.STRING(40), allowNull: false },
  currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'INR' },
  sourceId: { type: DataTypes.UUID, allowNull: false },
  sourceRecordId: { type: DataTypes.STRING(180), allowNull: false },
  fetchedAt: { type: DataTypes.DATE, allowNull: false },
  rawRecord: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
}, {
  tableName: 'market_prices',
  indexes: [
    { unique: true, fields: ['sourceId', 'sourceRecordId'] },
    { fields: ['commodityId', 'arrivalDate'] },
    { fields: ['marketId', 'arrivalDate'] },
  ],
});
