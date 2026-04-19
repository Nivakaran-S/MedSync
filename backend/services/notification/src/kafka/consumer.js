const { Kafka } = require('kafkajs');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');

const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
});

const consumer = kafka.consumer({ groupId: 'notification-group' });

const connectConsumer = async () => {
  try {
    await consumer.connect();
    console.log('Kafka Consumer connected');

    await consumer.subscribe({ topic: 'appointment-events', fromBeginning: true });
    await consumer.subscribe({ topic: 'payment-events', fromBeginning: true });
    await consumer.subscribe({ topic: 'patient-events', fromBeginning: true });
    await consumer.subscribe({ topic: 'doctor-events', fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const payload = JSON.parse(message.value.toString());
        console.log(`[Notification Service] Received event on ${topic}:`, payload.type);

        switch (payload.type) {
          case 'APPOINTMENT_CREATED':
            await handleAppointmentCreated(payload.data);
            break;
          case 'PAYMENT_SUCCESSFUL':
            await handlePaymentSuccessful(payload.data);
            break;
          case 'PATIENT_REGISTERED':
            await handlePatientRegistered(payload.data);
            break;
          default:
            console.log(`No handler for event type: ${payload.type}`);
        }
      },
    });
  } catch (error) {
    console.error('Error connecting Kafka Consumer', error);
  }
};

const handleAppointmentCreated = async (data) => {
  const { patientEmail, doctorName, date, time } = data;
  if (patientEmail) {
    const subject = `Appointment Confirmed with Dr. ${doctorName}`;
    const text = `Your appointment is scheduled for ${new Date(date).toLocaleDateString()} at ${time}.`;
    await emailService.sendEmail(patientEmail, subject, text);
    await smsService.sendSMS('0000000000', text); // mock phone number
  }
};

const handlePaymentSuccessful = async (data) => {
  const { patientEmail, amount, appointmentId } = data;
  if (patientEmail) {
    const subject = `Payment successful for Appointment ${appointmentId}`;
    const text = `We have successfully received your payment of $${amount}.`;
    await emailService.sendEmail(patientEmail, subject, text);
  }
};

const handlePatientRegistered = async (data) => {
  const { email, name } = data;
  if (email) {
    const subject = 'Welcome to MedSync';
    const text = `Hello ${name},\nWelcome to MedSync! Your account has been successfully created.`;
    await emailService.sendEmail(email, subject, text);
  }
};

module.exports = { connectConsumer };
