const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('MarketplaceOrder', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  buyerId: { type: DataTypes.STRING(120), allowNull: false },
  sellerId: { type: DataTypes.STRING(120), allowNull: false },
  addressId: { type: DataTypes.UUID, allowNull: true },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled', 'rejected', 'refund_pending', 'refunded'),
    allowNull: false,
    defaultValue: 'pending',
  },
  paymentMethod: { type: DataTypes.ENUM('cod', 'razorpay'), allowNull: false },
  paymentStatus: { type: DataTypes.ENUM('pending', 'paid', 'failed', 'cod_due', 'refunded', 'cancelled'), allowNull: false, defaultValue: 'pending' },
  subtotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  deliveryCharge: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  cancellationReason: { type: DataTypes.STRING(500), allowNull: true },
}, { tableName: 'marketplace_orders', indexes: [{ fields: ['buyerId', 'createdAt'] }, { fields: ['sellerId', 'status', 'createdAt'] }] });
