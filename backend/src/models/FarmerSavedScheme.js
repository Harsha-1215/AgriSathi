const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('FarmerSavedScheme', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.STRING(120), allowNull: false },
  schemeId: { type: DataTypes.UUID, allowNull: false },
}, {
  tableName: 'farmer_saved_schemes',
  indexes: [{ unique: true, fields: ['userId', 'schemeId'] }, { fields: ['userId', 'createdAt'] }],
});
