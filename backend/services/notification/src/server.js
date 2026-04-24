const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const mongoose = require('mongoose');
const app = require('./app');
const { connectConsumer } = require('./kafka/consumer');

const port = process.env.PORT || 3006;

const mongoOpts = {
  serverSelectionTimeoutMS: 20000,
  connectTimeoutMS: 20000,
  socketTimeoutMS: 45000,
  family: 4,
};

const start = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.warn('[notification] MONGO_URI is not set — in-app notifications will not be persisted');
  } else {
    await mongoose.connect(uri, mongoOpts);
    console.log('[notification] MongoDB connected');
  }
  await connectConsumer();
  app.listen(port, () => console.log(`[notification] listening on ${port}`));
};

start().catch((err) => {
  console.error('[notification] failed to start:', err);
  process.exit(1);
});
