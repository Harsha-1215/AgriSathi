const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('WeatherAdvisory', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.STRING(255), allowNull: true },
  locationHash: { type: DataTypes.STRING(64), allowNull: false },
  cropId: { type: DataTypes.STRING(80), allowNull: true },
  advisoryType: { type: DataTypes.STRING(80), allowNull: false },
  content: { type: DataTypes.JSONB, allowNull: false },
  sources: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  generatedAt: { type: DataTypes.DATE, allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'weather_advisories',
  indexes: [{ fields: ['userId', 'generatedAt'] }, { fields: ['locationHash', 'expiresAt'] }],
});
