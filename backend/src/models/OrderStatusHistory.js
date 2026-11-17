const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('OrderStatusHistory', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  orderId: { type: DataTypes.UUID, allowNull: false },
  changedBy: { type: DataTypes.STRING(120), allowNull: false },
  fromStatus: { type: DataTypes.STRING(40), allowNull: true },
  toStatus: { type: DataTypes.STRING(40), allowNull: false },
  note: { type: DataTypes.STRING(500), allowNull: true },
}, { tableName: 'marketplace_order_status_history', indexes: [{ fields: ['orderId', 'createdAt'] }] });
