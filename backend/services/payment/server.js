const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const mongoose = require('mongoose');
const app = require('./src/app');
const { connectProducer, startConsumer } = require('./src/utils/kafka');

const PORT = process.env.PORT || 3005;

const mongoOpts = {
  serverSelectionTimeoutMS: 20000,
  connectTimeoutMS: 20000,
  socketTimeoutMS: 45000,
  family: 4,
};

const start = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  const conn = await mongoose.connect(uri, mongoOpts);
  console.log(`[payment] MongoDB connected: ${conn.connection.host}`);

  await connectProducer();
  startConsumer().catch((err) => console.error('[payment] consumer crashed:', err));

  app.listen(PORT, () => console.log(`[payment] listening on ${PORT}`));
};

start().catch((err) => {
  console.error('[payment] failed to start:', err);
  process.exit(1);
});
