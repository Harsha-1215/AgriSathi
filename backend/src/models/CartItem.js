const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('CartItem', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  cartId: { type: DataTypes.UUID, allowNull: false },
  productId: { type: DataTypes.UUID, allowNull: false },
  quantity: { type: DataTypes.DECIMAL(12, 3), allowNull: false, validate: { min: 0.001 } },
}, { tableName: 'marketplace_cart_items', indexes: [{ unique: true, fields: ['cartId', 'productId'] }] });
