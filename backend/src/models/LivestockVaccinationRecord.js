const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('LivestockVaccinationRecord', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  listingId: { type: DataTypes.UUID, allowNull: false },
  vaccineName: { type: DataTypes.STRING(180), allowNull: false },
  administeredAt: { type: DataTypes.DATEONLY, allowNull: false },
  veterinarianName: { type: DataTypes.STRING(160), allowNull: true },
  certificatePublicId: { type: DataTypes.STRING(255), allowNull: true, unique: true },
  certificateFormat: { type: DataTypes.STRING(20), allowNull: true },
}, { tableName: 'livestock_vaccination_records', indexes: [{ fields: ['listingId', 'administeredAt'] }] });
