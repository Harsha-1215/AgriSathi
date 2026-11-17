const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('AgriVideoView', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  videoId: { type: DataTypes.UUID, allowNull: false },
  userId: { type: DataTypes.STRING(120), allowNull: false },
  watchedDuration: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: 'agri_video_views',
  indexes: [{ unique: true, fields: ['videoId', 'userId'] }, { fields: ['userId', 'createdAt'] }],
});
