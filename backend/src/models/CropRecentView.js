const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('CropRecentView', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.STRING(120), allowNull: false },
  cropId: { type: DataTypes.STRING(80), allowNull: false },
  lastViewedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'crop_recent_views',
  indexes: [{ unique: true, fields: ['userId', 'cropId'] }, { fields: ['userId', 'lastViewedAt'] }],
});
