const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  appointmentId: { type: String, required: true, unique: true },
  doctorId: { type: String, required: true },
  patientId: { type: String, required: true },
  signalingUrl: { type: String }, // This is the crucial field for auto-discovery
  status: { type: String, enum: ['active', 'ended'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  endedAt: { type: Date }
});

module.exports = mongoose.model('Session', sessionSchema);
