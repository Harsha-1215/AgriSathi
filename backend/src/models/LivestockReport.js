const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('LivestockReport', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  listingId: { type: DataTypes.UUID, allowNull: false },
  reporterId: { type: DataTypes.STRING(120), allowNull: false },
  reason: { type: DataTypes.ENUM('misleading', 'unsafe', 'fraud', 'prohibited', 'other'), allowNull: false },
  description: { type: DataTypes.STRING(1600), allowNull: true },
  status: { type: DataTypes.ENUM('open', 'reviewed', 'dismissed', 'action_taken'), allowNull: false, defaultValue: 'open' },
  adminNote: { type: DataTypes.STRING(1000), allowNull: true },
  reviewedBy: { type: DataTypes.STRING(120), allowNull: true },
  reviewedAt: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'livestock_reports', indexes: [{ unique: true, fields: ['listingId', 'reporterId'] }, { fields: ['status', 'createdAt'] }] });
