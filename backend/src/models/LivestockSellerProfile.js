const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('LivestockSellerProfile', {
  userId: { type: DataTypes.STRING(120), primaryKey: true },
  sellerName: { type: DataTypes.STRING(160), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  contactPhone: { type: DataTypes.STRING(30), allowNull: true },
  allowPhoneContact: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  isSuspended: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  state: { type: DataTypes.STRING(100), allowNull: true },
  district: { type: DataTypes.STRING(100), allowNull: true },
  mandal: { type: DataTypes.STRING(100), allowNull: true },
  village: { type: DataTypes.STRING(120), allowNull: true },
  pinCode: { type: DataTypes.STRING(10), allowNull: true },
  verificationStatus: { type: DataTypes.ENUM('pending', 'verified', 'rejected'), allowNull: false, defaultValue: 'pending' },
  verificationNote: { type: DataTypes.STRING(500), allowNull: true },
  verifiedAt: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'livestock_seller_profiles', timestamps: true, indexes: [{ fields: ['verificationStatus'] }, { fields: ['district'] }] });
