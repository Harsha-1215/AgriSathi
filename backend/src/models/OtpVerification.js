const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('OtpVerification', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.UUID, allowNull: true, references: { model: 'users', key: 'id' } },
  identifier: { type: DataTypes.STRING(254), allowNull: false },
  purpose: { type: DataTypes.ENUM('registration', 'password_reset'), allowNull: false },
  pendingData: { type: DataTypes.JSONB, allowNull: true },
  codeHash: { type: DataTypes.STRING(64), allowNull: false },
  expiresAt: { type: DataTypes.DATE, allowNull: false },
  consumedAt: { type: DataTypes.DATE, allowNull: true },
  attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  sentAt: { type: DataTypes.DATE, allowNull: false },
}, {
  tableName: 'otp_verifications',
  indexes: [{ fields: ['identifier', 'purpose', 'createdAt'] }, { fields: ['userId', 'purpose'] }],
});
