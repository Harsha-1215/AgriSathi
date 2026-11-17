const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('ProductReport', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  productId: { type: DataTypes.UUID, allowNull: false },
  reporterId: { type: DataTypes.STRING(120), allowNull: false },
  reason: { type: DataTypes.ENUM('misleading', 'unsafe', 'prohibited', 'counterfeit', 'spam', 'other'), allowNull: false },
  description: { type: DataTypes.STRING(1500), allowNull: true },
  status: { type: DataTypes.ENUM('open', 'reviewed', 'dismissed'), allowNull: false, defaultValue: 'open' },
  reviewedBy: { type: DataTypes.STRING(120), allowNull: true },
}, { tableName: 'marketplace_product_reports', indexes: [{ unique: true, fields: ['productId', 'reporterId'] }, { fields: ['status', 'createdAt'] }] });
