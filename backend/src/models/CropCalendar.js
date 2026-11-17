const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('CropCalendar', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  cropId: { type: DataTypes.STRING(80), allowNull: false },
  language: { type: DataTypes.ENUM('en', 'te', 'hi'), allowNull: false },
  state: { type: DataTypes.STRING(120), allowNull: false },
  district: { type: DataTypes.STRING(120), allowNull: true },
  season: { type: DataTypes.STRING(120), allowNull: false },
  sowingWindow: { type: DataTypes.JSONB, allowNull: false },
  harvestingWindow: { type: DataTypes.JSONB, allowNull: false },
  activities: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  source: { type: DataTypes.STRING(1000), allowNull: true },
  verifiedBy: { type: DataTypes.STRING(120), allowNull: true },
  verifiedAt: { type: DataTypes.DATE, allowNull: true },
  isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: 'crop_calendars',
  indexes: [{ fields: ['cropId', 'state', 'district', 'isPublished'] }],
});
