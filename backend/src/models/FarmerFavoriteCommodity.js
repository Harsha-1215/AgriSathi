const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('FarmerFavoriteCommodity', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.STRING(255), allowNull: false },
  commodityId: { type: DataTypes.STRING(80), allowNull: false },
}, {
  tableName: 'farmer_favorite_commodities',
  indexes: [{ unique: true, fields: ['userId', 'commodityId'] }, { fields: ['userId'] }],
});
