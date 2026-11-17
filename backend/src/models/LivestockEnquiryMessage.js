const { DataTypes } = require('sequelize');

module.exports = (sequelize) => sequelize.define('LivestockEnquiryMessage', {
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  enquiryId: { type: DataTypes.UUID, allowNull: false },
  senderId: { type: DataTypes.STRING(120), allowNull: false },
  message: { type: DataTypes.STRING(3000), allowNull: false },
}, { tableName: 'livestock_enquiry_messages', indexes: [{ fields: ['enquiryId', 'createdAt'] }] });
