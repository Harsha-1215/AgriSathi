const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('CropBookmark', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.STRING(120), allowNull: false },
  cropId: { type: DataTypes.STRING(80), allowNull: false },
}, {
  tableName: 'crop_bookmarks',
  indexes: [{ unique: true, fields: ['userId', 'cropId'] }, { fields: ['userId', 'createdAt'] }],
});
