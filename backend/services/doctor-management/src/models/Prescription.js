const mongoose = require('mongoose');

const prescriptionSchema = new mongoose.Schema({
  patientId: { type: String, required: true },
  patientName: { type: String, required: true },
  doctorId: { type: String, required: true },
  doctorName: { type: String, required: true },
  appointmentId: { type: String, required: true },
  medications: [
    {
      medication: { type: String, required: true },
      dosage: { type: String, required: true },
      frequency: String,
      duration: String,
    }
  ],
  instructions: String,
  verificationId: { type: String, required: true, unique: true },
  signatureBase64: { type: String, required: true },
  status: { type: String, enum: ['active', 'cancelled', 'dispensed'], default: 'active' },
  issuedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Prescription', prescriptionSchema);
