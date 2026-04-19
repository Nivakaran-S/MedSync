const { Kafka } = require('kafkajs');
const Appointment = require('../models/Appointment');

const kafka = new Kafka({
  clientId: 'appointment-service-consumer',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
});

const consumer = kafka.consumer({ groupId: 'appointment-doctor-sync-group' });

const connectConsumer = async () => {
  try {
    await consumer.connect();
    console.log('[Appointment Service] Kafka Consumer connected');

    await consumer.subscribe({ topic: 'doctor-events', fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const payload = JSON.parse(message.value.toString());
          console.log(`[Appointment Service Consumer] Event: ${payload.type}`);

          if (payload.type === 'DOCTOR_SUSPENDED') {
            await handleDoctorSuspended(payload);
          }
        } catch (err) {
          console.error('[Appointment Service Consumer] Error processing message:', err.message);
        }
      },
    });
  } catch (error) {
    console.error('[Appointment Service Consumer] Failed to connect:', error.message);
  }
};

const handleDoctorSuspended = async ({ doctorId }) => {
  if (!doctorId) return;
  try {
    const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const result = await Appointment.updateMany(
      {
        doctorId: String(doctorId),
        status: { $in: ['pending', 'confirmed'] },
        slotDate: { $gte: now },
      },
      {
        $set: {
          status: 'cancelled',
          cancelledBy: 'admin',
          cancellationReason: 'Doctor account suspended by administrator',
        },
      }
    );
    console.log(`[Appointment Service] Auto-cancelled ${result.modifiedCount} future appointments for suspended doctor ${doctorId}`);
  } catch (err) {
    console.error('[Appointment Service] Failed to cancel appointments on doctor suspension:', err.message);
  }
};

module.exports = { connectConsumer };
