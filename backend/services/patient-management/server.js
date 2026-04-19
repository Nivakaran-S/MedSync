const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const mongoose = require('mongoose');
const app = require('./src/app');
const { connectProducer } = require('./src/utils/kafka');
const { connectPrescriptionConsumer } = require('./src/prescriptionConsumer');

const port = process.env.PORT || 3001;

const mongoOpts = {
  dbName: 'medsync',
  serverSelectionTimeoutMS: 20000,
  connectTimeoutMS: 20000,
  socketTimeoutMS: 45000,
  family: 4,
};

const start = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  await mongoose.connect(uri, mongoOpts);
  console.log('[patient-management] MongoDB connected');
  app.listen(port, () => {
    console.log(`[patient-management] listening on ${port}`);
    // Start Kafka in the background so it doesn't block login requests
    connectProducer().catch(err => console.error('Kafka Producer Error:', err));
    connectPrescriptionConsumer().catch(err => console.error('Kafka Consumer Error:', err));
  });
};

start().catch((err) => {
  console.error('[patient-management] failed to start:', err);
  process.exit(1);
});
