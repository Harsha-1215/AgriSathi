const { DataTypes, Op } = require('sequelize');

module.exports = (sequelize) => sequelize.define('AgriVideoReport', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  videoId: { type: DataTypes.UUID, allowNull: false },
  commentId: { type: DataTypes.UUID, allowNull: true },
  reportedBy: { type: DataTypes.STRING(120), allowNull: false },
  reason: { type: DataTypes.ENUM('misinformation', 'unsafe_advice', 'spam', 'copyright', 'other'), allowNull: false },
  description: { type: DataTypes.STRING(1000), allowNull: true },
  status: { type: DataTypes.ENUM('open', 'reviewed', 'dismissed'), allowNull: false, defaultValue: 'open' },
  reviewedBy: { type: DataTypes.STRING(120), allowNull: true },
}, {
  tableName: 'agri_video_reports',
  indexes: [
    { unique: true, fields: ['videoId', 'reportedBy'], where: { commentId: null } },
    { unique: true, fields: ['commentId', 'reportedBy'], where: { commentId: { [Op.ne]: null } } },
    { fields: ['status', 'createdAt'] },
  ],
});
