const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('AgriVideoComment', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  videoId: { type: DataTypes.UUID, allowNull: false },
  userId: { type: DataTypes.STRING(120), allowNull: false },
  parentCommentId: { type: DataTypes.UUID, allowNull: true },
  comment: { type: DataTypes.STRING(1200), allowNull: false },
  status: { type: DataTypes.ENUM('published', 'hidden'), allowNull: false, defaultValue: 'published' },
  likeCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, {
  tableName: 'agri_video_comments',
  indexes: [{ fields: ['videoId', 'status', 'createdAt'] }, { fields: ['userId', 'createdAt'] }],
});
