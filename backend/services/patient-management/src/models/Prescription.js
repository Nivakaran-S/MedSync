const mongoose = require('mongoose');

// Shared schema for recovery purposes
const prescriptionSchema = new mongoose.Schema({
  patientId: { type: String, required: true },
  patientName: { type: String, required: true },
  medications: [
    {
      medication: { type: String },
      dosage: { type: String },
      frequency: String,
      duration: String,
    }
  ],
  instructions: String,
  doctorName: { type: String },
  doctorId: { type: String },
  verificationId: { type: String },
  issuedAt: { type: Date },
  // Same source convention as medical records / documents.
  source: { type: String, enum: ['self', 'doctor', 'admin'], default: 'self' },
  createdById: { type: String },
  createdByName: { type: String },
}, { strict: false }); // Allow flexibility in schema during recovery

module.exports = mongoose.model('Prescription', prescriptionSchema, 'prescriptions');
