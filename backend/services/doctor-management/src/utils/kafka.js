const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'doctor-management',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

const producer = kafka.producer();
let connected = false;

const connectProducer = async () => {
  try {
    await producer.connect();
    connected = true;
    console.log('[doctor-management] Kafka Producer connected');
  } catch (error) {
    console.error('[doctor-management] Kafka connect failed:', error.message);
  }
};

const sendEvent = async (topic, message) => {
  if (!connected) return;
  try {
    await producer.send({ topic, messages: [{ value: JSON.stringify(message) }] });
    console.log(`[doctor-management] sent ${message.type} to ${topic}`);
  } catch (error) {
    console.error(`[doctor-management] Kafka send failed:`, error.message);
  }
};

module.exports = { connectProducer, sendEvent };
