const mongoose = require('mongoose');

const symptomCheckFeedbackSchema = new mongoose.Schema(
  {
    checkId: { type: mongoose.Schema.Types.ObjectId, ref: 'SymptomCheck', required: true, index: true },
    patientId: { type: String, index: true },
    type: {
      type: String,
      enum: ['false-positive', 'false-negative', 'correct'],
      required: true,
    },
    comment: { type: String, default: '' },
    submittedBy: { type: String }, // user id of submitter
    role: { type: String, enum: ['patient', 'doctor', 'admin'], default: 'patient' },
  },
  { timestamps: true }
);

// One feedback per (checkId, submittedBy) — let users update their own.
symptomCheckFeedbackSchema.index({ checkId: 1, submittedBy: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('SymptomCheckFeedback', symptomCheckFeedbackSchema);
