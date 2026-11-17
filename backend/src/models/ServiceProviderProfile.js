const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('ServiceProviderProfile', {
  userId: { type: DataTypes.UUID, primaryKey: true, references: { model: 'users', key: 'id' } },
  businessName: { type: DataTypes.STRING(180), allowNull: false },
  contactPerson: { type: DataTypes.STRING(160), allowNull: false },
  serviceCategories: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  serviceCoverage: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  serviceDescription: { type: DataTypes.STRING(3000), allowNull: false },
  pricing: { type: DataTypes.STRING(1000), allowNull: true },
  workingHours: { type: DataTypes.STRING(500), allowNull: true },
  state: { type: DataTypes.STRING(120), allowNull: true },
  district: { type: DataTypes.STRING(120), allowNull: true },
  village: { type: DataTypes.STRING(120), allowNull: true },
  pinCode: { type: DataTypes.STRING(10), allowNull: true },
  documentPublicId: { type: DataTypes.STRING(500), allowNull: true },
  documentFormat: { type: DataTypes.STRING(20), allowNull: true },
  approvalStatus: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), allowNull: false, defaultValue: 'pending' },
}, { tableName: 'service_provider_profiles', indexes: [{ fields: ['approvalStatus', 'district'] }] });
