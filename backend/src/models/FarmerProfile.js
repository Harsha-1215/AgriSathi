const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('FarmerProfile', {
  userId: { type: DataTypes.UUID, primaryKey: true, references: { model: 'users', key: 'id' } },
  state: { type: DataTypes.STRING(120), allowNull: true },
  district: { type: DataTypes.STRING(120), allowNull: true },
  mandal: { type: DataTypes.STRING(120), allowNull: true },
  village: { type: DataTypes.STRING(120), allowNull: true },
  pinCode: { type: DataTypes.STRING(10), allowNull: true },
  farmName: { type: DataTypes.STRING(160), allowNull: true },
  farmLocation: { type: DataTypes.STRING(500), allowNull: true },
  landArea: { type: DataTypes.DECIMAL(16, 4), allowNull: true },
  areaUnit: { type: DataTypes.STRING(40), allowNull: true },
  primaryCrop: { type: DataTypes.STRING(120), allowNull: true },
  otherCrops: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  soilType: { type: DataTypes.STRING(120), allowNull: true },
  irrigationType: { type: DataTypes.STRING(120), allowNull: true },
  experience: { type: DataTypes.INTEGER, allowNull: true },
  preferredLanguage: { type: DataTypes.ENUM('en', 'te', 'hi'), allowNull: false, defaultValue: 'en' },
  latitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  longitude: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
  profileImageUrl: { type: DataTypes.STRING(1200), allowNull: true },
}, { tableName: 'farmer_profiles' });
