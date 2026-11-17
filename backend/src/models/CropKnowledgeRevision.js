const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('CropKnowledgeRevision', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  knowledgeId: { type: DataTypes.UUID, allowNull: false },
  version: { type: DataTypes.INTEGER, allowNull: false },
  snapshot: { type: DataTypes.JSONB, allowNull: false },
  changedBy: { type: DataTypes.STRING(120), allowNull: false },
}, {
  tableName: 'crop_knowledge_revisions',
  indexes: [{ unique: true, fields: ['knowledgeId', 'version'] }],
});
