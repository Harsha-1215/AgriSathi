const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('MarketplaceOrderItem', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  orderId: { type: DataTypes.UUID, allowNull: false },
  productId: { type: DataTypes.UUID, allowNull: true },
  sellerId: { type: DataTypes.STRING(120), allowNull: false },
  productName: { type: DataTypes.STRING(200), allowNull: false },
  unit: { type: DataTypes.STRING(40), allowNull: false },
  fulfillmentMethod: { type: DataTypes.ENUM('delivery', 'pickup'), allowNull: false, defaultValue: 'delivery' },
  pickupLocation: { type: DataTypes.STRING(500), allowNull: true },
  quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false },
  unitPrice: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  lineTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
}, { tableName: 'marketplace_order_items', indexes: [{ fields: ['orderId'] }, { fields: ['sellerId', 'productId'] }] });
