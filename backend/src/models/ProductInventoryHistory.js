const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('ProductInventoryHistory', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  productId: { type: DataTypes.UUID, allowNull: false },
  sellerId: { type: DataTypes.STRING(120), allowNull: false },
  changedBy: { type: DataTypes.STRING(120), allowNull: false },
  previousQuantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
  newQuantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
  reason: { type: DataTypes.STRING(240), allowNull: false },
}, { tableName: 'marketplace_inventory_history', indexes: [{ fields: ['productId', 'createdAt'] }] });
