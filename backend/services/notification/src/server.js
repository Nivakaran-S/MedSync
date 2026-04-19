const app = require('./app');
const { connectConsumer } = require('./kafka/consumer');

const port = process.env.PORT || 3006;

const start = async () => {
  await connectConsumer();
  app.listen(port, () => console.log(`[notification] listening on ${port}`));
};

start().catch((err) => {
  console.error('[notification] failed to start:', err);
  process.exit(1);
});
