const { Kafka } = require('kafkajs');
const Patient = require('./models/Patient');

const kafka = new Kafka({
  clientId: 'patient-management-prescription-sync',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
});

const consumer = kafka.consumer({ groupId: 'prescription-sync-group-v2' }); // New group to force re-reading if needed

const connectPrescriptionConsumer = async () => {
  try {
    await consumer.connect();
    console.log('[Patient Service] Kafka Prescription Consumer connected');

    await consumer.subscribe({ topic: 'doctor-events', fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const messageId = `${topic}-${partition}-${message.offset}`;
        try {
          const payload = JSON.parse(message.value.toString());
          
          if (payload.type === 'PRESCRIPTION_ISSUED') {
            const { patientId, medications, instructions, doctorName, verificationId, timestamp } = payload;
            console.log(`[Patient Service] [${messageId}] Incoming Prescription: ${verificationId} for patient: ${patientId}`);
            
            if (!patientId || patientId.length !== 24) {
              console.warn(`[Patient Service] [${messageId}] INVALID PATIENT ID: ${patientId}. Length: ${patientId?.length}. Skipping.`);
              return;
            }

            // 1. Update Patient's Documents (link only)
            const updatedPatient = await Patient.findByIdAndUpdate(patientId, {
              $push: {
                documents: {
                  fileName: `Prescription_${verificationId || payload.prescriptionId}.pdf`,
                  fileUrl: `/verify/${verificationId || payload.prescriptionId}`, 
                  verificationId: verificationId || payload.prescriptionId,
                  uploadDate: new Date(),
                  type: 'Prescription'
                }
              }
            }, { new: true });
            
            if (!updatedPatient) {
              console.error(`[Patient Service] [${messageId}] SYNC FAILED: Patient ${patientId} not found in DB.`);
            } else {
              console.log(`[Patient Service] [${messageId}] SUCCESS: Synced prescription ${verificationId} to ${updatedPatient.firstName} ${updatedPatient.lastName}`);
            }
          }
        } catch (err) {
          console.error(`[Patient Service] [${messageId}] Error processing message:`, err);
        }
      },
    });
  } catch (error) {
    console.error('[Patient Service] Kafka Consumer connection error:', error);
  }
};

module.exports = { connectPrescriptionConsumer };
