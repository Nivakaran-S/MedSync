const mongoose = require('mongoose');

const symptomResultSchema = new mongoose.Schema(
  {
    specialty: { type: String, required: true },
    suggestions: { type: String, required: true },
    urgency: { type: String, enum: ['low', 'medium', 'high', 'emergency'], required: true },
    matchedKeywords: [String],
    confidence: { type: Number, min: 0, max: 1, default: 0.5 },
  },
  { _id: false }
);

const recommendedDoctorSchema = new mongoose.Schema(
  {
    doctorId: { type: String },
    name: { type: String },
    specialty: { type: String },
    isVerified: { type: Boolean },
    consultationFee: { type: Number },
    nextSlot: { type: String },
  },
  { _id: false }
);

const symptomCheckSchema = new mongoose.Schema(
  {
    patientId: { type: String, index: true },
    symptoms: { type: String, required: true },
    severity: { type: String, enum: ['mild', 'moderate', 'severe', 'unspecified'], default: 'unspecified' },
    durationDays: { type: Number, min: 0 },
    bodyLocation: { type: String },
    additionalContext: { type: String },

    aiSummary: { type: String },
    results: [symptomResultSchema],
    overallUrgency: { type: String, enum: ['low', 'medium', 'high', 'emergency'], default: 'low' },
    overallConfidence: { type: Number, min: 0, max: 1, default: 0.5 },

    drugInteractionWarnings: [String],
    allergyWarnings: [String],
    recommendedDoctors: [recommendedDoctorSchema],
    emergencyAlertSent: { type: Boolean, default: false },

    imageAnalyzed: { type: Boolean, default: false },
    sourceModel: { type: String, default: 'gemini-1.5-pro' },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SymptomCheck', symptomCheckSchema);
