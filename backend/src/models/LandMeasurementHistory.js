const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('LandMeasurementHistory', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.STRING(255), allowNull: false },
  plotId: { type: DataTypes.UUID, allowNull: true },
  action: { type: DataTypes.STRING(24), allowNull: false },
  snapshot: { type: DataTypes.JSONB, allowNull: false },
}, {
  tableName: 'land_measurement_history',
  indexes: [{ fields: ['userId', 'createdAt'] }, { fields: ['plotId', 'createdAt'] }],
});
