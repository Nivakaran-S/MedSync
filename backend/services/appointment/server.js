const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const app = require('./src/app');
const connectDB = require('./src/config/db');
const { connectProducer } = require('./src/utils/kafka');
const { connectConsumer } = require('./src/kafka/consumer');

const PORT = process.env.PORT || 3003;

const start = async () => {
  await connectDB();
  await connectProducer();
  // Start Kafka consumer (non-blocking — failures won't crash the service)
  connectConsumer().catch(err =>
    console.error('[appointment] Kafka consumer startup error:', err.message)
  );
  app.listen(PORT, () => console.log(`[appointment] listening on ${PORT}`));
};

start().catch((err) => {
  console.error('[appointment] failed to start:', err);
  process.exit(1);
});

