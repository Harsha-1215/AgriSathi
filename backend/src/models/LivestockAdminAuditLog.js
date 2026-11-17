const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('LivestockAdminAuditLog', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  adminId: { type: DataTypes.STRING(120), allowNull: false },
  entityType: { type: DataTypes.STRING(40), allowNull: false },
  entityId: { type: DataTypes.STRING(120), allowNull: true },
  action: { type: DataTypes.STRING(80), allowNull: false },
  details: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
}, { tableName: 'livestock_admin_audit_logs', indexes: [{ fields: ['entityType', 'entityId', 'createdAt'] }, { fields: ['adminId', 'createdAt'] }] });
