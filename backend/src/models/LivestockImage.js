const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('LivestockImage', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  listingId: { type: DataTypes.UUID, allowNull: false },
  assetType: { type: DataTypes.ENUM('image', 'video'), allowNull: false, defaultValue: 'image' },
  publicId: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  url: { type: DataTypes.STRING(1200), allowNull: false },
  format: { type: DataTypes.STRING(20), allowNull: false },
  bytes: { type: DataTypes.INTEGER, allowNull: false },
  durationSeconds: { type: DataTypes.INTEGER, allowNull: true },
  position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'livestock_images', indexes: [{ fields: ['listingId', 'position'] }] });
