const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('AgriVideoLike', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  videoId: { type: DataTypes.UUID, allowNull: false },
  userId: { type: DataTypes.STRING(120), allowNull: false },
}, {
  tableName: 'agri_video_likes',
  indexes: [{ unique: true, fields: ['videoId', 'userId'] }, { fields: ['userId', 'createdAt'] }],
});
