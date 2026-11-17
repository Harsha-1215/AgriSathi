const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('FarmerSchemeApplication', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  userId: { type: DataTypes.STRING(120), allowNull: false },
  schemeId: { type: DataTypes.UUID, allowNull: false },
  applicationReference: { type: DataTypes.STRING(180), allowNull: true },
  submissionDate: { type: DataTypes.DATEONLY, allowNull: true },
  status: {
    type: DataTypes.ENUM('draft', 'submitted', 'under_review', 'additional_information_required', 'approved', 'rejected', 'completed'),
    allowNull: false,
    defaultValue: 'draft',
  },
  statusSource: { type: DataTypes.ENUM('farmer_entered'), allowNull: false, defaultValue: 'farmer_entered' },
  notes: { type: DataTypes.STRING(2000), allowNull: true },
}, {
  tableName: 'farmer_scheme_applications',
  indexes: [{ fields: ['userId', 'updatedAt'] }, { fields: ['schemeId', 'status'] }],
});
