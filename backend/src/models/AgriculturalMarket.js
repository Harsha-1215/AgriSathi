const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('AgriculturalMarket', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  marketCode: { type: DataTypes.STRING(120), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(180), allowNull: false },
  state: { type: DataTypes.STRING(120), allowNull: false },
  district: { type: DataTypes.STRING(120), allowNull: false },
  mandal: { type: DataTypes.STRING(120), allowNull: true },
  address: { type: DataTypes.STRING(500), allowNull: true },
  latitude: { type: DataTypes.DECIMAL(9, 6), allowNull: true },
  longitude: { type: DataTypes.DECIMAL(9, 6), allowNull: true },
  sourceId: { type: DataTypes.UUID, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'agricultural_markets',
  indexes: [{ fields: ['state', 'district', 'isActive'] }],
});
