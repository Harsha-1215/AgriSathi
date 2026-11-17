const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('LivestockWishlist', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.STRING(120), allowNull: false },
  listingId: { type: DataTypes.UUID, allowNull: false },
}, { tableName: 'livestock_wishlist', indexes: [{ unique: true, fields: ['userId', 'listingId'] }, { fields: ['userId', 'createdAt'] }] });
