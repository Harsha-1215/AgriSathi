const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('SchemeUpdate', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  schemeId: { type: DataTypes.UUID, allowNull: false },
  title: { type: DataTypes.STRING(240), allowNull: false },
  summary: { type: DataTypes.TEXT, allowNull: false },
  source: { type: DataTypes.STRING(1000), allowNull: false },
  verifiedAt: { type: DataTypes.DATE, allowNull: false },
  createdBy: { type: DataTypes.STRING(120), allowNull: false },
}, {
  tableName: 'scheme_updates',
  indexes: [{ fields: ['schemeId', 'verifiedAt'] }, { fields: ['createdAt'] }],
});
