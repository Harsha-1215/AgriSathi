const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('LivestockHealthRecord', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  listingId: { type: DataTypes.UUID, allowNull: false },
  recordDate: { type: DataTypes.DATEONLY, allowNull: false },
  note: { type: DataTypes.STRING(1600), allowNull: false },
  veterinarianName: { type: DataTypes.STRING(160), allowNull: true },
  certificatePublicId: { type: DataTypes.STRING(255), allowNull: true, unique: true },
  certificateFormat: { type: DataTypes.STRING(20), allowNull: true },
}, { tableName: 'livestock_health_records', indexes: [{ fields: ['listingId', 'recordDate'] }] });
