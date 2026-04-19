const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'payment-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: 'payment-group' });

const connectProducer = async () => {
  try {
    await producer.connect();
    console.log('Kafka Producer connected in Payment Service');
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
    console.log(`[Kafka] Sent event ${message.type} to topic ${topic}`);
  } catch (error) {
    console.error(`Error sending message to topic ${topic}`, error);
  }
};

const startConsumer = async () => {
  const maxRetries = 10;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      await consumer.connect();
      console.log('Kafka Consumer connected in Payment Service');
      await consumer.subscribe({ topic: 'appointment-events', fromBeginning: false });
      
      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const value = JSON.parse(message.value.toString());
            if (value.type === 'APPOINTMENT_CANCELLED') {
              const ctrl = require('../controllers/paymentController');
              await ctrl.handleAppointmentCancelledEvent(value.data);
            }
          } catch (err) {
            console.error('[Kafka] Error processing message in payment service:', err);
          }
        }
      });
      break; // Successfully connected, break the loop
    } catch (error) {
      retries++;
      console.error(`[Kafka] Error connecting Kafka Consumer (Attempt ${retries}/${maxRetries}):`, error.message);
      if (retries >= maxRetries) {
        console.error('[Kafka] Max retries reached. Payment refund consumer failed to start.');
      } else {
        await new Promise(res => setTimeout(res, 5000));
      }
    }
  }
};

module.exports = { connectProducer, sendEvent, startConsumer };
