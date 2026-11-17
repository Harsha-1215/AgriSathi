const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('ExpertProfile', {
  userId: { type: DataTypes.UUID, primaryKey: true, references: { model: 'users', key: 'id' } },
  qualification: { type: DataTypes.STRING(180), allowNull: false },
  specialization: { type: DataTypes.STRING(180), allowNull: false },
  organization: { type: DataTypes.STRING(180), allowNull: true },
  experience: { type: DataTypes.INTEGER, allowNull: true },
  languages: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  state: { type: DataTypes.STRING(120), allowNull: true },
  district: { type: DataTypes.STRING(120), allowNull: true },
  mandal: { type: DataTypes.STRING(120), allowNull: true },
  village: { type: DataTypes.STRING(120), allowNull: true },
  pinCode: { type: DataTypes.STRING(10), allowNull: true },
  certificatePublicId: { type: DataTypes.STRING(500), allowNull: true },
  certificateFormat: { type: DataTypes.STRING(20), allowNull: true },
  approvalStatus: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), allowNull: false, defaultValue: 'pending' },
}, { tableName: 'expert_profiles', indexes: [{ fields: ['approvalStatus', 'district'] }] });
