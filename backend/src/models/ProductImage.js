const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('ProductImage', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  productId: { type: DataTypes.UUID, allowNull: false },
  publicId: { type: DataTypes.STRING(500), allowNull: false },
  imageUrl: { type: DataTypes.STRING(1200), allowNull: false },
  position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'marketplace_product_images', indexes: [{ fields: ['productId', 'position'] }] });
