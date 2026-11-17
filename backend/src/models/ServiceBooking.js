const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('ServiceBooking', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  farmerId: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' } },
  providerId: { type: DataTypes.UUID, allowNull: false, references: { model: 'service_provider_profiles', key: 'userId' } },
  serviceCategory: { type: DataTypes.STRING(160), allowNull: false },
  requestedDate: { type: DataTypes.DATEONLY, allowNull: false },
  landArea: { type: DataTypes.DECIMAL(12, 4), allowNull: true, validate: { min: 0.0001 } },
  cropType: { type: DataTypes.STRING(120), allowNull: true },
  state: { type: DataTypes.STRING(120), allowNull: true },
  district: { type: DataTypes.STRING(120), allowNull: false },
  mandal: { type: DataTypes.STRING(120), allowNull: true },
  village: { type: DataTypes.STRING(120), allowNull: false },
  notes: { type: DataTypes.STRING(1500), allowNull: true },
  status: {
    type: DataTypes.STRING(16),
    allowNull: false,
    defaultValue: 'requested',
    validate: { isIn: [['requested', 'accepted', 'rejected', 'cancelled', 'completed']] },
  },
  confirmedAt: { type: DataTypes.DATE, allowNull: false },
}, {
  tableName: 'service_bookings',
  indexes: [
    { fields: ['farmerId', 'createdAt'] },
    { fields: ['providerId', 'status', 'requestedDate'] },
  ],
});
