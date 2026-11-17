const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('WishlistItem', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  wishlistId: { type: DataTypes.UUID, allowNull: false },
  productId: { type: DataTypes.UUID, allowNull: false },
}, { tableName: 'marketplace_wishlist_items', indexes: [{ unique: true, fields: ['wishlistId', 'productId'] }] });
