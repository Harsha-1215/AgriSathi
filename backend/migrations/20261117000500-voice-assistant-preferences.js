const { DataTypes } = require('sequelize');

module.exports = {
  async up({ queryInterface, transaction }) {
    const addedColumns = [];
    const preferenceColumns = await queryInterface.describeTable('user_preferences', { transaction });
    if (!preferenceColumns.interactionMode) {
      await queryInterface.addColumn('user_preferences', 'interactionMode', {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: 'normal',
      }, { transaction });
      await queryInterface.addConstraint('user_preferences', {
        fields: ['interactionMode'],
        type: 'check',
        where: { interactionMode: ['normal', 'voice'] },
        name: 'user_preferences_interaction_mode_check',
        transaction,
      });
      addedColumns.push(['user_preferences', 'interactionMode']);
    }

    const otpColumns = await queryInterface.describeTable('otp_verifications', { transaction });
    if (!otpColumns.pendingData) {
      await queryInterface.addColumn('otp_verifications', 'pendingData', {
        type: DataTypes.JSONB,
        allowNull: true,
      }, { transaction });
      addedColumns.push(['otp_verifications', 'pendingData']);
    }
    return { addedColumns };
  },

  async down({ queryInterface, transaction, state = { addedColumns: [] } }) {
    for (const [table, column] of [...state.addedColumns].reverse()) {
      const existing = await queryInterface.describeTable(table, { transaction });
      if (existing[column]) await queryInterface.removeColumn(table, column, { transaction });
    }
  },
};
