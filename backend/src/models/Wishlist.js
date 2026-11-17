const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('Wishlist', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.STRING(120), allowNull: false, unique: true },
}, { tableName: 'marketplace_wishlists' });
