const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('BuyerProfile', {
  userId: { type: DataTypes.UUID, primaryKey: true, references: { model: 'users', key: 'id' } },
  buyerCategory: { type: DataTypes.STRING(120), allowNull: true },
  productInterests: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  organization: { type: DataTypes.STRING(180), allowNull: true },
  description: { type: DataTypes.STRING(1500), allowNull: true },
  state: { type: DataTypes.STRING(120), allowNull: true },
  district: { type: DataTypes.STRING(120), allowNull: true },
  mandal: { type: DataTypes.STRING(120), allowNull: true },
  village: { type: DataTypes.STRING(120), allowNull: true },
  pinCode: { type: DataTypes.STRING(10), allowNull: true },
}, { tableName: 'buyer_profiles' });
