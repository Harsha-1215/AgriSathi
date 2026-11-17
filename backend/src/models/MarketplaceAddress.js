const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('MarketplaceAddress', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  buyerId: { type: DataTypes.STRING(120), allowNull: false },
  recipientName: { type: DataTypes.STRING(160), allowNull: false },
  phone: { type: DataTypes.STRING(30), allowNull: false },
  addressLine1: { type: DataTypes.STRING(240), allowNull: false },
  addressLine2: { type: DataTypes.STRING(240), allowNull: true },
  village: { type: DataTypes.STRING(120), allowNull: false },
  mandal: { type: DataTypes.STRING(120), allowNull: true },
  district: { type: DataTypes.STRING(120), allowNull: false },
  state: { type: DataTypes.STRING(120), allowNull: false },
  pinCode: { type: DataTypes.STRING(10), allowNull: false },
}, { tableName: 'marketplace_addresses', indexes: [{ fields: ['buyerId', 'createdAt'] }] });
