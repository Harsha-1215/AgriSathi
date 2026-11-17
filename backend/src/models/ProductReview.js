const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('ProductReview', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  productId: { type: DataTypes.UUID, allowNull: false },
  buyerId: { type: DataTypes.STRING(120), allowNull: false },
  orderItemId: { type: DataTypes.UUID, allowNull: false, unique: true },
  rating: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
  review: { type: DataTypes.STRING(2000), allowNull: true },
  images: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  verifiedPurchase: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  status: { type: DataTypes.ENUM('pending', 'approved', 'hidden'), allowNull: false, defaultValue: 'pending' },
  moderationNote: { type: DataTypes.STRING(1000), allowNull: true },
}, { tableName: 'marketplace_product_reviews', indexes: [{ fields: ['productId', 'status', 'createdAt'] }, { fields: ['buyerId', 'createdAt'] }] });
