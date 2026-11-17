const { DataTypes, QueryTypes } = require('sequelize');

const configuredInterfaces = new WeakSet();

function isBlockedPlpgsqlError(error) {
  const message = [error.message, error.parent?.message].filter(Boolean).join('\n');
  return /plpgsql\.dll/i.test(message) && /Application Control policy has blocked/i.test(message);
}

async function ensureEnumsWithoutProceduralLanguage(queryInterface, tableName, attributes, options = {}) {
  const { sequelize, queryGenerator } = queryInterface;
  for (const [key, attribute] of Object.entries(attributes)) {
    const type = attribute.type;
    const enumType = type instanceof DataTypes.ENUM
      ? type
      : type instanceof DataTypes.ARRAY && type.type instanceof DataTypes.ENUM ? type.type : null;
    if (!enumType) continue;

    const field = attribute.field || key;
    const existing = await sequelize.query(queryGenerator.pgListEnums(tableName, field, options), {
      ...options,
      plain: true,
      raw: true,
      type: QueryTypes.SELECT,
    });
    const enumName = queryGenerator.pgEnumName(tableName, field, options);
    if (!existing) {
      const labels = enumType.values.map((value) => sequelize.escape(value)).join(', ');
      await sequelize.query(`CREATE TYPE ${enumName} AS ENUM (${labels})`, options);
      continue;
    }

    const existingValues = queryGenerator.fromArray(existing.enum_value);
    for (const value of enumType.values) {
      if (!existingValues.includes(value)) {
        await sequelize.query(`ALTER TYPE ${enumName} ADD VALUE IF NOT EXISTS ${sequelize.escape(value)}`, options);
      }
    }
  }
}

function configureEnumSync(queryInterface) {
  if (configuredInterfaces.has(queryInterface)) return;
  const originalEnsureEnums = queryInterface.ensureEnums.bind(queryInterface);
  queryInterface.ensureEnums = async (tableName, attributes, options = {}, model) => {
    try {
      return await originalEnsureEnums(tableName, attributes, options, model);
    } catch (error) {
      if (!isBlockedPlpgsqlError(error)) throw error;
      return ensureEnumsWithoutProceduralLanguage(queryInterface, tableName, attributes, options);
    }
  };
  configuredInterfaces.add(queryInterface);
}

module.exports = configureEnumSync;
