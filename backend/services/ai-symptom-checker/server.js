const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const mongoose = require('mongoose');
const app = require('./src/app');
const { connectProducer } = require('./src/utils/kafka');

const port = process.env.PORT || 3007;

const mongoOpts = {
  serverSelectionTimeoutMS: 20000,
  connectTimeoutMS: 20000,
  socketTimeoutMS: 45000,
  family: 4,
};

const start = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  await mongoose.connect(uri, mongoOpts);
  console.log('[ai-symptom-checker] MongoDB connected');
  await connectProducer();
  app.listen(port, () => console.log(`[ai-symptom-checker] listening on ${port}`));
};

start().catch((err) => {
  console.error('[ai-symptom-checker] failed to start:', err);
  process.exit(1);
});
