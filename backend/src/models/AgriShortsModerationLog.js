const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('AgriShortsModerationLog', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  videoId: { type: DataTypes.UUID, allowNull: true },
  adminId: { type: DataTypes.STRING(120), allowNull: false },
  action: { type: DataTypes.STRING(60), allowNull: false },
  reason: { type: DataTypes.STRING(1000), allowNull: true },
  details: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
}, {
  tableName: 'agri_shorts_moderation_logs',
  indexes: [{ fields: ['videoId', 'createdAt'] }, { fields: ['adminId', 'createdAt'] }],
});
