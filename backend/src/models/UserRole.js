const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('UserRole', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.UUID, allowNull: false, references: { model: 'users', key: 'id' } },
  role: { type: DataTypes.STRING(40), allowNull: false },
}, {
  tableName: 'user_roles',
  indexes: [{ unique: true, fields: ['userId', 'role'] }, { fields: ['role'] }],
});
