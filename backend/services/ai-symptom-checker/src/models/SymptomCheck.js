const mongoose = require('mongoose');

const icd10CodeSchema = new mongoose.Schema(
  { code: { type: String }, description: { type: String } },
  { _id: false }
);

const symptomResultSchema = new mongoose.Schema(
  {
    specialty: { type: String, required: true },
    suggestions: { type: String, required: true },
    urgency: { type: String, enum: ['low', 'medium', 'high', 'emergency'], required: true },
    matchedKeywords: [String],
    confidence: { type: Number, min: 0, max: 1, default: 0.5 },
    icd10Codes: { type: [icd10CodeSchema], default: [] },
    demographicNote: { type: String },
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

const redFlagSchema = new mongoose.Schema(
  { code: { type: String }, label: { type: String }, advice: { type: String } },
  { _id: false }
);

const sideEffectWarningSchema = new mongoose.Schema(
  { drug: { type: String }, symptomMatch: { type: String }, note: { type: String }, advice: { type: String } },
  { _id: false }
);

const progressionSchema = new mongoose.Schema(
  {
    trend: { type: String, enum: ['improving', 'stable', 'worsening', 'unknown'], default: 'unknown' },
    explanation: { type: String },
    referenceCheckIds: [String],
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
    language: { type: String, default: 'en' },

    aiSummary: { type: String },
    results: [symptomResultSchema],
    overallUrgency: { type: String, enum: ['low', 'medium', 'high', 'emergency'], default: 'low' },
    overallConfidence: { type: Number, min: 0, max: 1, default: 0.5 },

    // Severity NLP cross-check (#3)
    impliedSeverity: { type: String, enum: ['mild', 'moderate', 'severe', 'unspecified'], default: 'unspecified' },
    severityMismatchNote: { type: String },

    // Red-flag detection (#1) — list of clusters that fired
    redFlags: { type: [redFlagSchema], default: [] },
    urgencyOverrideReason: { type: String },

    // Drug-symptom side-effect cross-check (#5)
    possibleDrugSideEffects: { type: [sideEffectWarningSchema], default: [] },

    // Symptom progression (#6)
    progression: { type: progressionSchema, default: null },

    drugInteractionWarnings: [String],
    allergyWarnings: [String],
    recommendedDoctors: [recommendedDoctorSchema],
    emergencyAlertSent: { type: Boolean, default: false },

    // Image analysis kind (#11)
    imageAnalyzed: { type: Boolean, default: false },
    imageKind: { type: String, enum: ['skin', 'rash', 'wound', 'lab-report', 'xray', 'ecg', 'other', null], default: null },

    sourceModel: { type: String, default: 'gemini-1.5-pro' },
    promptVersion: { type: String },
    confidenceFlag: { type: String, enum: ['LOW', 'OK'], default: 'OK' },
    followUpAt: { type: Date, default: null },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SymptomCheck', symptomCheckSchema);
