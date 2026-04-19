const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'patient-management-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
});

const producer = kafka.producer();

const connectProducer = async () => {
  try {
    await producer.connect();
    console.log('Kafka Producer connected');
  } catch (error) {
    console.error('Error connecting Kafka Producer', error);
  }
};

const sendEvent = async (topic, message) => {
  try {
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }]
    });
  } catch (error) {
    console.error(`Error sending message to topic ${topic}`, error);
  }
};

module.exports = { connectProducer, sendEvent };
