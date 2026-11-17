const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('FarmerCrop', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' } },
  farmId: { type: DataTypes.UUID, allowNull: true, references: { model: 'farmer_farms', key: 'id' } },
  cropId: { type: DataTypes.STRING(80), allowNull: true, references: { model: 'crops', key: 'id' } },
  cropName: { type: DataTypes.STRING(120), allowNull: false },
  variety: { type: DataTypes.STRING(160), allowNull: true },
  cultivationArea: { type: DataTypes.DECIMAL(16, 4), allowNull: false },
  areaUnit: { type: DataTypes.STRING(40), allowNull: false },
  sowingDate: { type: DataTypes.DATEONLY, allowNull: true },
  expectedHarvestDate: { type: DataTypes.DATEONLY, allowNull: true },
  season: { type: DataTypes.STRING(80), allowNull: true },
  growthStage: { type: DataTypes.STRING(120), allowNull: true },
  status: { type: DataTypes.ENUM('planned', 'active', 'harvested', 'cancelled'), allowNull: false, defaultValue: 'active' },
}, {
  tableName: 'farmer_crops',
  indexes: [{ fields: ['userId', 'status', 'sowingDate'] }, { fields: ['farmId', 'status'] }],
});
