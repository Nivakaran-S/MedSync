const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true, index: true },
    patientName: { type: String, required: true },
    patientEmail: { type: String, required: true },
    patientPhone: { type: String },

    doctorId: { type: String, required: true, index: true },
    doctorName: { type: String, required: true },
    specialty: { type: String, required: true },

    slotDate: { type: String, required: true },
    slotTime: { type: String, required: true },
    reason: { type: String, required: true },
    consultationFee: { type: Number, required: true, min: 0 },
    doctorConsultationFee: { type: Number, min: 0 },
    systemFee: { type: Number, min: 0 },
    totalConsultationFee: { type: Number, min: 0 },

    paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },
    paymentId: { type: String },

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed', 'rejected'],
      default: 'pending',
    },
    cancelledBy: { type: String },
    cancellationReason: { type: String },
    notes: { type: String },
  },
  { timestamps: true }
);

appointmentSchema.index({ doctorId: 1, slotDate: 1, slotTime: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
