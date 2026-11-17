const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('LandMeasurement', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.STRING(255), allowNull: false },
  plotId: { type: DataTypes.UUID, allowNull: true },
  measurementMethod: { type: DataTypes.STRING(24), allowNull: false },
  input: { type: DataTypes.JSONB, allowNull: false },
  result: { type: DataTypes.JSONB, allowNull: false },
  formulaVersion: { type: DataTypes.STRING(32), allowNull: false, defaultValue: '1' },
}, {
  tableName: 'land_measurements',
  indexes: [{ fields: ['userId', 'createdAt'] }, { fields: ['plotId', 'createdAt'] }],
});
