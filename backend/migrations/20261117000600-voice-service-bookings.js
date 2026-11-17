const { DataTypes } = require('sequelize');

module.exports = {
  async up({ queryInterface, transaction }) {
    const tables = await queryInterface.showAllTables({ transaction });
    if (tables.includes('service_bookings')) return { created: false };
    await queryInterface.createTable('service_bookings', {
      id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
      farmerId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      providerId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'service_provider_profiles', key: 'userId' },
        onDelete: 'CASCADE',
      },
      serviceCategory: { type: DataTypes.STRING(160), allowNull: false },
      requestedDate: { type: DataTypes.DATEONLY, allowNull: false },
      landArea: { type: DataTypes.DECIMAL(12, 4), allowNull: true },
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
      },
      confirmedAt: { type: DataTypes.DATE, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    }, { transaction });
    await queryInterface.addConstraint('service_bookings', {
      fields: ['status'],
      type: 'check',
      where: { status: ['requested', 'accepted', 'rejected', 'cancelled', 'completed'] },
      name: 'service_bookings_status_check',
      transaction,
    });
    await queryInterface.addIndex('service_bookings', ['farmerId', 'createdAt'], { transaction });
    await queryInterface.addIndex('service_bookings', ['providerId', 'status', 'requestedDate'], { transaction });
    return { created: true };
  },

  async down({ queryInterface, transaction, state = { created: false } }) {
    if (state.created) await queryInterface.dropTable('service_bookings', { transaction });
  },
};
