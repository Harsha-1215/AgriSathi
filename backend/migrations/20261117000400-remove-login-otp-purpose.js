async function findOtpPurposeEnum(queryInterface, transaction) {
  const [types] = await queryInterface.sequelize.query(
    `SELECT namespace.nspname AS schema_name, type.typname AS type_name
     FROM pg_attribute AS attribute
     JOIN pg_type AS type ON type.oid = attribute.atttypid
     JOIN pg_class AS relation ON relation.oid = attribute.attrelid
     JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
     WHERE relation.relname = 'otp_verifications' AND attribute.attname = 'purpose'
       AND attribute.attnum > 0 AND NOT attribute.attisdropped`,
    { transaction },
  );
  return types[0] || null;
}

function quotedEnum(queryInterface, schemaName, typeName) {
  const quote = queryInterface.queryGenerator.quoteIdentifier.bind(queryInterface.queryGenerator);
  return `${quote(schemaName)}.${quote(typeName)}`;
}

module.exports = {
  async up({ queryInterface, transaction }) {
    if (queryInterface.sequelize.getDialect() !== 'postgres') return;
    const enumType = await findOtpPurposeEnum(queryInterface, transaction);
    if (!enumType) return;

    const quote = queryInterface.queryGenerator.quoteIdentifier.bind(queryInterface.queryGenerator);
    const table = `${quote(enumType.schema_name)}.${quote('otp_verifications')}`;
    const replacementName = `${enumType.type_name}_without_login`;
    const replacementEnum = quotedEnum(queryInterface, enumType.schema_name, replacementName);
    await queryInterface.sequelize.query(`DELETE FROM ${table} WHERE purpose = 'login'`, { transaction });
    await queryInterface.sequelize.query(
      `CREATE TYPE ${replacementEnum} AS ENUM ('registration', 'password_reset')`,
      { transaction },
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE ${table} ALTER COLUMN purpose TYPE ${replacementEnum} USING purpose::text::${replacementEnum}`,
      { transaction },
    );
    await queryInterface.sequelize.query(
      `DROP TYPE ${quotedEnum(queryInterface, enumType.schema_name, enumType.type_name)}`,
      { transaction },
    );
    await queryInterface.sequelize.query(
      `ALTER TYPE ${replacementEnum} RENAME TO ${quote(enumType.type_name)}`,
      { transaction },
    );
  },

  async down({ queryInterface, transaction }) {
    if (queryInterface.sequelize.getDialect() !== 'postgres') return;
    const enumType = await findOtpPurposeEnum(queryInterface, transaction);
    if (!enumType) return;
    await queryInterface.sequelize.query(
      `ALTER TYPE ${quotedEnum(queryInterface, enumType.schema_name, enumType.type_name)} ADD VALUE IF NOT EXISTS 'login'`,
      { transaction },
    );
  },
};
