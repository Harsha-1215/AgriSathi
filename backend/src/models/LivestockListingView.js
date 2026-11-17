const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('LivestockListingView', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  listingId: { type: DataTypes.UUID, allowNull: false },
  userId: { type: DataTypes.STRING(120), allowNull: false },
  viewedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { tableName: 'livestock_listing_views', indexes: [{ unique: true, fields: ['listingId', 'userId'] }, { fields: ['listingId', 'viewedAt'] }] });
