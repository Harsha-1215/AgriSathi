const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('ProductEnquiry', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  productId: { type: DataTypes.UUID, allowNull: false },
  buyerId: { type: DataTypes.STRING(120), allowNull: false },
  sellerId: { type: DataTypes.STRING(120), allowNull: false },
  question: { type: DataTypes.STRING(2000), allowNull: false },
  requestedQuantity: { type: DataTypes.DECIMAL(12, 3), allowNull: true },
  status: { type: DataTypes.ENUM('open', 'answered', 'closed'), allowNull: false, defaultValue: 'open' },
  reply: { type: DataTypes.STRING(2000), allowNull: true },
  respondedAt: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'marketplace_product_enquiries', indexes: [{ fields: ['buyerId', 'createdAt'] }, { fields: ['sellerId', 'status', 'createdAt'] }] });
