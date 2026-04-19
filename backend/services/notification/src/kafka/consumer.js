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
        try {
          const payload = JSON.parse(message.value.toString());
          console.log(`[Notification Service] Received event on ${topic}:`, payload.type);

          switch (payload.type) {
            case 'APPOINTMENT_CREATED':
              await handleAppointmentCreated(payload.data);
              break;
            case 'APPOINTMENT_STATUS_UPDATED':
              await handleAppointmentStatusUpdated(payload.data);
              break;
            case 'APPOINTMENT_CANCELLED':
              await handleAppointmentCancelled(payload.data);
              break;
            case 'PAYMENT_SUCCESSFUL':
              await handlePaymentSuccessful(payload.data);
              break;
            case 'PATIENT_REGISTERED':
              await handlePatientRegistered(payload.data);
              break;
            case 'DOCTOR_REGISTERED':
              await handleDoctorRegistered(payload.data);
              break;
            default:
              console.log(`[Notification Service] No handler for event type: ${payload.type}`);
          }
        } catch (err) {
          console.error('[Notification Service] Error processing message:', err.message);
        }
      },
    });
  } catch (error) {
    console.error('Error connecting Kafka Consumer', error);
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const notify = async ({ email, phone, subject, text }) => {
  if (email) {
    await emailService.sendEmail(email, subject, text).catch(e =>
      console.error('[Notification] Email failed:', e.message)
    );
  }
  if (phone) {
    await smsService.sendSMS(phone, text).catch(e =>
      console.error('[Notification] SMS failed:', e.message)
    );
  }
};

// ── Handlers ──────────────────────────────────────────────────────────────────

const handleAppointmentCreated = async (data) => {
  const { patientEmail, patientPhone, doctorName, date, time } = data;
  const subject = `Appointment Booked with Dr. ${doctorName}`;
  const text = `Your appointment with Dr. ${doctorName} has been booked for ${new Date(date).toLocaleDateString()} at ${time}. Awaiting confirmation.`;
  await notify({ email: patientEmail, phone: patientPhone, subject, text });
};

const handleAppointmentStatusUpdated = async (data) => {
  const { status, patientEmail, patientPhone, doctorName, slotDate, slotTime } = data;
  const label = status === 'confirmed' ? 'Confirmed' : 'Rejected';
  const subject = `Appointment ${label} — Dr. ${doctorName}`;
  const text = status === 'confirmed'
    ? `Great news! Your appointment with Dr. ${doctorName} on ${new Date(slotDate).toLocaleDateString()} at ${slotTime} has been CONFIRMED.`
    : `Your appointment request with Dr. ${doctorName} on ${new Date(slotDate).toLocaleDateString()} at ${slotTime} was not accepted. Please book a different slot.`;
  await notify({ email: patientEmail, phone: patientPhone, subject, text });
};

const handleAppointmentCancelled = async (data) => {
  const { patientEmail, patientPhone, doctorName, cancelledBy } = data;
  const subject = `Appointment Cancelled`;
  const text = `Your appointment with Dr. ${doctorName} has been cancelled${cancelledBy ? ` by ${cancelledBy}` : ''}. Please book a new appointment if needed.`;
  await notify({ email: patientEmail, phone: patientPhone, subject, text });
};

const handlePaymentSuccessful = async (data) => {
  const { patientEmail, patientPhone, amount, appointmentId } = data;
  const subject = `Payment Successful — MedSync`;
  const text = `We have successfully received your payment of $${amount} for appointment ${appointmentId}. Your booking is now confirmed.`;
  await notify({ email: patientEmail, phone: patientPhone, subject, text });
};

const handlePatientRegistered = async (data) => {
  const { email, phone, name } = data;
  const subject = 'Welcome to MedSync';
  const text = `Hello ${name},\n\nWelcome to MedSync! Your account has been successfully created. You can now search for doctors and book your first appointment.`;
  await notify({ email, phone, subject, text });
};

const handleDoctorRegistered = async (data) => {
  const { email, name, specialty } = data;
  const subject = 'Welcome to MedSync — Doctor Account Created';
  const text = `Hello Dr. ${name},\n\nYour MedSync doctor account (${specialty}) has been created. An admin will review and verify your credentials shortly.`;
  if (email) {
    await emailService.sendEmail(email, subject, text).catch(e =>
      console.error('[Notification] Doctor welcome email failed:', e.message)
    );
  }
};

module.exports = { connectConsumer };
