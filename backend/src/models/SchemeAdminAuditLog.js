const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('SchemeAdminAuditLog', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  schemeId: { type: DataTypes.UUID, allowNull: true },
  adminId: { type: DataTypes.STRING(120), allowNull: false },
  action: { type: DataTypes.STRING(60), allowNull: false },
  details: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
}, {
  tableName: 'scheme_admin_audit_logs',
  indexes: [{ fields: ['schemeId', 'createdAt'] }, { fields: ['adminId', 'createdAt'] }],
});
