const { Kafka } = require('kafkajs');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const { createInAppNotification } = require('../controllers/notificationController');

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

          // Some publishers use { type, data: {...} } and others flatten fields
          // onto the payload itself (e.g. PRESCRIPTION_ISSUED). Normalize here.
          const data = payload.data || payload;

          switch (payload.type) {
            case 'APPOINTMENT_CREATED':
              await handleAppointmentCreated(data);
              break;
            case 'APPOINTMENT_STATUS_UPDATED':
              await handleAppointmentStatusUpdated(data);
              break;
            case 'APPOINTMENT_CANCELLED':
              await handleAppointmentCancelled(data);
              break;
            case 'APPOINTMENT_COMPLETED':
              await handleAppointmentCompleted(data);
              break;
            case 'PAYMENT_SUCCESSFUL':
              await handlePaymentSuccessful(data);
              break;
            case 'PRESCRIPTION_ISSUED':
              await handlePrescriptionIssued(data);
              break;
            case 'PATIENT_REGISTERED':
              await handlePatientRegistered(data);
              break;
            case 'DOCTOR_REGISTERED':
              await handleDoctorRegistered(data);
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

const notify = async ({ email, phone, subject, text, userId, category, metadata }) => {
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
  if (userId) {
    await createInAppNotification({
      userId,
      title: subject,
      subject,
      message: text,
      category: category || 'other',
      metadata: metadata || {}
    });
  }
};

// ── Handlers ──────────────────────────────────────────────────────────────────

const handleAppointmentCreated = async (data) => {
  const { patientId, patientEmail, patientPhone, doctorName, date, time, appointmentId } = data;
  const subject = `Appointment Booked with Dr. ${doctorName}`;
  const text = `Your appointment with Dr. ${doctorName} has been booked for ${new Date(date).toLocaleDateString()} at ${time}. Awaiting confirmation.`;
  await notify({
    email: patientEmail,
    phone: patientPhone,
    subject,
    text,
    userId: patientId,
    category: 'appointment',
    metadata: { appointmentId, status: 'pending' }
  });
};

const handleAppointmentStatusUpdated = async (data) => {
  const { status, patientId, patientEmail, patientPhone, doctorName, slotDate, slotTime, appointmentId } = data;
  const label = status === 'confirmed' ? 'Confirmed' : status === 'rejected' ? 'Rejected' : status;
  const subject = `Appointment ${label} — Dr. ${doctorName}`;
  const text = status === 'confirmed'
    ? `Great news! Your appointment with Dr. ${doctorName} on ${new Date(slotDate).toLocaleDateString()} at ${slotTime} has been CONFIRMED.`
    : status === 'rejected'
      ? `Your appointment request with Dr. ${doctorName} on ${new Date(slotDate).toLocaleDateString()} at ${slotTime} was not accepted. Please book a different slot.`
      : `Your appointment with Dr. ${doctorName} is now ${status}.`;
  await notify({
    email: patientEmail,
    phone: patientPhone,
    subject,
    text,
    userId: patientId,
    category: 'appointment',
    metadata: { appointmentId, status }
  });
};

const handleAppointmentCancelled = async (data) => {
  const { patientId, patientEmail, patientPhone, doctorName, cancelledBy, appointmentId } = data;
  const subject = `Appointment Cancelled`;
  const text = `Your appointment with Dr. ${doctorName} has been cancelled${cancelledBy ? ` by ${cancelledBy}` : ''}. Please book a new appointment if needed.`;
  await notify({
    email: patientEmail,
    phone: patientPhone,
    subject,
    text,
    userId: patientId,
    category: 'appointment',
    metadata: { appointmentId, status: 'cancelled', cancelledBy }
  });
};

const handleAppointmentCompleted = async (data) => {
  const { patientId, patientEmail, patientPhone, doctorName, slotDate, slotTime, appointmentId } = data;
  const subject = `Consultation Completed — Dr. ${doctorName}`;
  const dateStr = slotDate ? new Date(slotDate).toLocaleDateString() : '';
  const text = `Your consultation with Dr. ${doctorName}${dateStr ? ` on ${dateStr}` : ''}${slotTime ? ` at ${slotTime}` : ''} has been marked as completed. Thank you for using MedSync.`;
  await notify({
    email: patientEmail,
    phone: patientPhone,
    subject,
    text,
    userId: patientId,
    category: 'appointment',
    metadata: { appointmentId, status: 'completed' }
  });
};

const handlePaymentSuccessful = async (data) => {
  const { patientId, patientEmail, patientPhone, amount, currency, appointmentId } = data;
  const subject = `Payment Successful — MedSync`;
  const text = `We have successfully received your payment of ${String(currency || 'LKR').toUpperCase()} ${Number(amount || 0).toLocaleString()} for appointment ${appointmentId}. Your booking is now confirmed.`;
  await notify({
    email: patientEmail,
    phone: patientPhone,
    subject,
    text,
    userId: patientId,
    category: 'payment',
    metadata: { appointmentId, amount }
  });
};

const handlePrescriptionIssued = async (data) => {
  const { patientId, patientEmail, patientPhone, doctorName, verificationId, medications, instructions } = data;
  const subject = `New Prescription from Dr. ${doctorName}`;
  const medLine = Array.isArray(medications) && medications.length
    ? medications.map(m => m.name || m.medication || (typeof m === 'string' ? m : '')).filter(Boolean).join(', ')
    : '';
  const body = [
    `Dr. ${doctorName} has issued a new prescription for you.`,
    medLine ? `Medications: ${medLine}.` : '',
    instructions ? `Instructions: ${instructions}` : '',
    verificationId ? `Verification ID: ${verificationId}` : ''
  ].filter(Boolean).join(' ');
  await notify({
    email: patientEmail,
    phone: patientPhone,
    subject,
    text: body,
    userId: patientId,
    category: 'prescription',
    metadata: { verificationId, doctorName }
  });
};

const handlePatientRegistered = async (data) => {
  const { patientId, _id, email, phone, name } = data;
  const subject = 'Welcome to MedSync';
  const text = `Hello ${name},\n\nWelcome to MedSync! Your account has been successfully created. You can now search for doctors and book your first appointment.`;
  await notify({
    email,
    phone,
    subject,
    text,
    userId: patientId || _id,
    category: 'account'
  });
};

const handleDoctorRegistered = async (data) => {
  const { doctorId, _id, email, name, specialty } = data;
  const subject = 'Welcome to MedSync — Doctor Account Created';
  const text = `Hello Dr. ${name},\n\nYour MedSync doctor account (${specialty}) has been created. An admin will review and verify your credentials shortly.`;
  if (email) {
    await emailService.sendEmail(email, subject, text).catch(e =>
      console.error('[Notification] Doctor welcome email failed:', e.message)
    );
  }
  if (doctorId || _id) {
    await createInAppNotification({
      userId: doctorId || _id,
      title: subject,
      subject,
      message: text,
      category: 'account'
    });
  }
};

module.exports = { connectConsumer };
