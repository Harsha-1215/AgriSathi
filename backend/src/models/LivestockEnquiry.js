const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('LivestockEnquiry', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  listingId: { type: DataTypes.UUID, allowNull: false },
  buyerId: { type: DataTypes.STRING(120), allowNull: false },
  sellerId: { type: DataTypes.STRING(120), allowNull: false },
  subject: { type: DataTypes.STRING(180), allowNull: false },
  status: { type: DataTypes.ENUM('open', 'responded', 'closed'), allowNull: false, defaultValue: 'open' },
}, { tableName: 'livestock_enquiries', indexes: [{ fields: ['buyerId', 'createdAt'] }, { fields: ['sellerId', 'status', 'createdAt'] }, { fields: ['listingId', 'buyerId'] }] });
