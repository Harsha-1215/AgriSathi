const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('AgriVideo', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  creatorId: { type: DataTypes.STRING(120), allowNull: false },
  creatorDisplayName: { type: DataTypes.STRING(160), allowNull: false },
  title: { type: DataTypes.STRING(180), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  videoUrl: { type: DataTypes.STRING(1200), allowNull: false },
  cloudinaryPublicId: { type: DataTypes.STRING(500), allowNull: false },
  thumbnailUrl: { type: DataTypes.STRING(1200), allowNull: true },
  categoryId: { type: DataTypes.UUID, allowNull: false },
  cropId: { type: DataTypes.STRING(80), allowNull: true },
  language: { type: DataTypes.ENUM('en', 'te', 'hi'), allowNull: false },
  duration: { type: DataTypes.INTEGER, allowNull: false },
  tags: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  captionsVtt: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), allowNull: false, defaultValue: 'pending' },
  rejectionReason: { type: DataTypes.TEXT, allowNull: true },
  viewCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  likeCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  isFeatured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  sourceReference: { type: DataTypes.STRING(1000), allowNull: true },
  publishedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'agri_videos',
  indexes: [
    { fields: ['status', 'publishedAt'] },
    { fields: ['categoryId', 'status', 'publishedAt'] },
    { fields: ['cropId', 'status'] },
    { fields: ['language', 'status'] },
    { fields: ['creatorId', 'createdAt'] },
  ],
});
