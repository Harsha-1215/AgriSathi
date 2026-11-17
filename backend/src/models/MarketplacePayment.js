const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('MarketplacePayment', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  orderId: { type: DataTypes.UUID, allowNull: false },
  provider: { type: DataTypes.ENUM('razorpay', 'cod'), allowNull: false },
  providerOrderId: { type: DataTypes.STRING(180), allowNull: true, unique: true },
  providerPaymentId: { type: DataTypes.STRING(180), allowNull: true, unique: true },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'succeeded', 'failed', 'refunded', 'cancelled'), allowNull: false, defaultValue: 'pending' },
  signatureVerified: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  webhookEventId: { type: DataTypes.STRING(180), allowNull: true, unique: true },
}, { tableName: 'marketplace_payments', indexes: [{ fields: ['orderId', 'status'] }] });
