const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('AgriVideoCommentLike', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  commentId: { type: DataTypes.UUID, allowNull: false },
  userId: { type: DataTypes.STRING(120), allowNull: false },
}, {
  tableName: 'agri_video_comment_likes',
  indexes: [{ unique: true, fields: ['commentId', 'userId'] }],
});
