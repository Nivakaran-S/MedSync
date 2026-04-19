const app = require('./src/app');
const connectDB = require('./src/config/db');
const seedAdmin = require('./src/config/seed');

const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  console.error('[auth] FATAL: JWT_SECRET is not set');
  process.exit(1);
}

const start = async () => {
  await connectDB();
  await seedAdmin();
  app.listen(PORT, () => console.log(`[auth] listening on ${PORT}`));
};

start().catch((err) => {
  console.error('[auth] failed to start:', err);
  process.exit(1);
});
