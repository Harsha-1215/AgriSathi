const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('HomepageContent', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  contentType: { type: DataTypes.STRING(60), allowNull: false },
  title: { type: DataTypes.STRING(200), allowNull: false },
  summary: { type: DataTypes.STRING(1200), allowNull: true },
  content: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  imageUrl: { type: DataTypes.STRING(1200), allowNull: true },
  route: { type: DataTypes.STRING(300), allowNull: true },
  language: { type: DataTypes.ENUM('en', 'te', 'hi'), allowNull: false, defaultValue: 'en' },
  status: { type: DataTypes.ENUM('draft', 'pending', 'approved', 'rejected'), allowNull: false, defaultValue: 'draft' },
  isFeatured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  publishedAt: { type: DataTypes.DATE, allowNull: true },
  expiresAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'homepage_contents',
  indexes: [{ fields: ['status', 'contentType', 'publishedAt'] }, { fields: ['isFeatured', 'status'] }],
});
