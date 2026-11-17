const { DataTypes } = require('sequelize');

const columnDefinitions = {
  crops: {
    source: { type: DataTypes.STRING(1000), allowNull: true },
    verifiedBy: { type: DataTypes.STRING(120), allowNull: true },
    verifiedAt: { type: DataTypes.DATE, allowNull: true },
    isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    isFeatured: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  calculator_history: {
    formulaVersion: { type: DataTypes.STRING(32), allowNull: false, defaultValue: '1' },
  },
  crop_diagnoses: {
    externalProcessingConsent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    externalProcessingConsentAt: { type: DataTypes.DATE, allowNull: true },
  },
};

module.exports = {
  async up({ queryInterface, transaction }) {
    const addedColumns = [];
    for (const [table, columns] of Object.entries(columnDefinitions)) {
      const existing = await queryInterface.describeTable(table, { transaction });
      for (const [column, definition] of Object.entries(columns)) {
        if (existing[column]) continue;
        await queryInterface.addColumn(table, column, definition, { transaction });
        addedColumns.push({ table, column });
      }
    }
    return { addedColumns };
  },

  async down({ queryInterface, transaction, state = { addedColumns: [] } }) {
    for (const { table, column } of [...state.addedColumns].reverse()) {
      const existing = await queryInterface.describeTable(table, { transaction });
      if (existing[column]) await queryInterface.removeColumn(table, column, { transaction });
    }
  },
};
