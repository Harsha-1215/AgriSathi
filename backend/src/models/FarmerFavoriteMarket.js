const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('FarmerFavoriteMarket', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.STRING(255), allowNull: false },
  marketId: { type: DataTypes.UUID, allowNull: false },
}, {
  tableName: 'farmer_favorite_markets',
  indexes: [{ unique: true, fields: ['userId', 'marketId'] }, { fields: ['userId'] }],
});
