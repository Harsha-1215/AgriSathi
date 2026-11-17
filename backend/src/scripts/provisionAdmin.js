require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, User, UserRole } = require('../models');

async function provisionAdmin() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_MOBILE, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_MOBILE || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
    throw new Error('Set ADMIN_NAME, ADMIN_EMAIL, ADMIN_MOBILE, and a 12-character ADMIN_PASSWORD before provisioning.');
  }
  await sequelize.authenticate();
  const email = ADMIN_EMAIL.trim().toLowerCase();
  const mobile = ADMIN_MOBILE.trim().replace(/[ ()-]/g, '');
  const existing = await User.findOne({ where: { email } });
  if (existing) throw new Error('An account already uses ADMIN_EMAIL.');
  const transaction = await sequelize.transaction();
  try {
    const user = await User.create({
      fullName: ADMIN_NAME.trim(),
      email,
      mobile,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
      status: 'active',
      isVerified: true,
    }, { transaction });
    await UserRole.create({ userId: user.id, role: 'admin' }, { transaction });
    await transaction.commit();
    process.stdout.write(`Provisioned administrator account ${user.id}.\n`);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

provisionAdmin()
  .catch((error) => {
    process.stderr.write(`Administrator provisioning failed: ${error.message}\n`);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
