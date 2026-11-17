const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('SellerProfile', {
  userId: { type: DataTypes.STRING(120), primaryKey: true },
  businessName: { type: DataTypes.STRING(180), allowNull: false },
  description: { type: DataTypes.STRING(1500), allowNull: true },
  verificationStatus: { type: DataTypes.ENUM('pending', 'verified', 'rejected'), allowNull: false, defaultValue: 'pending' },
  verificationNote: { type: DataTypes.STRING(1000), allowNull: true },
  licenseNumber: { type: DataTypes.STRING(180), allowNull: true },
  sellerCategory: { type: DataTypes.STRING(120), allowNull: true },
  productCategories: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  state: { type: DataTypes.STRING(120), allowNull: true },
  district: { type: DataTypes.STRING(120), allowNull: true },
  mandal: { type: DataTypes.STRING(120), allowNull: true },
  village: { type: DataTypes.STRING(120), allowNull: true },
  pinCode: { type: DataTypes.STRING(10), allowNull: true },
}, { tableName: 'marketplace_seller_profiles', indexes: [{ fields: ['verificationStatus'] }] });
