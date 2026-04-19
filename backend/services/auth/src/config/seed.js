const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

const seedAdmin = async () => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('[auth] ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin seed');
    return;
  }
  const existing = await Admin.findOne({ email });
  if (existing) return;
  const hash = await bcrypt.hash(password, 12);
  await Admin.create({ email, password: hash, name: 'Super Admin' });
  console.log(`[auth] Seeded admin: ${email}`);
};

module.exports = seedAdmin;
