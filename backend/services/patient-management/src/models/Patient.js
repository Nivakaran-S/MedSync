const mongoose = require('mongoose');

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const allergySchema = new mongoose.Schema(
  {
    substance: { type: String, required: true },
    severity: { type: String, enum: ['mild', 'moderate', 'severe', 'life-threatening'], default: 'mild' },
    reaction: { type: String },
    diagnosedDate: { type: Date },
  },
  { _id: true, timestamps: true }
);

const vitalSignSchema = new mongoose.Schema(
  {
    recordedAt: { type: Date, default: Date.now },
    heightCm: { type: Number, min: 30, max: 280 },
    weightKg: { type: Number, min: 0.5, max: 700 },
    bmi: { type: Number },
    bloodPressureSystolic: { type: Number, min: 40, max: 260 },
    bloodPressureDiastolic: { type: Number, min: 20, max: 200 },
    heartRateBpm: { type: Number, min: 20, max: 250 },
    temperatureC: { type: Number, min: 25, max: 45 },
    oxygenSaturation: { type: Number, min: 50, max: 100 },
    respiratoryRate: { type: Number, min: 4, max: 80 },
    bloodGlucose: { type: Number },
    notes: { type: String },
    recordedBy: { type: String, default: 'self' },
  },
  { _id: true, timestamps: true }
);

vitalSignSchema.pre('validate', function (next) {
  if (this.heightCm && this.weightKg && !this.bmi) {
    const m = this.heightCm / 100;
    this.bmi = Math.round((this.weightKg / (m * m)) * 10) / 10;
  }
  next();
});

const vaccinationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    dose: { type: String },
    administeredAt: { type: Date, default: Date.now },
    administeredBy: { type: String },
    batchNumber: { type: String },
    nextDueDate: { type: Date },
    notes: { type: String },
  },
  { _id: true, timestamps: true }
);

const chronicConditionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    diagnosedDate: { type: Date },
    severity: { type: String, enum: ['mild', 'moderate', 'severe'], default: 'moderate' },
    status: { type: String, enum: ['active', 'managed', 'in remission', 'resolved'], default: 'active' },
    medications: [String],
    notes: { type: String },
  },
  { _id: true, timestamps: true }
);

const familyHistorySchema = new mongoose.Schema(
  {
    relation: {
      type: String,
      enum: ['mother', 'father', 'sibling', 'grandparent', 'aunt', 'uncle', 'cousin', 'child', 'other'],
      required: true,
    },
    condition: { type: String, required: true },
    ageOfOnset: { type: Number },
    notes: { type: String },
  },
  { _id: true, timestamps: true }
);

const insuranceSchema = new mongoose.Schema(
  {
    provider: { type: String },
    policyNumber: { type: String },
    groupNumber: { type: String },
    validFrom: { type: Date },
    validUntil: { type: Date },
    coverage: { type: String, enum: ['basic', 'standard', 'premium', 'enterprise'], default: 'standard' },
    notes: { type: String },
  },
  { _id: false }
);

const medicalRecordSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    description: { type: String, required: true },
    diagnosis: { type: String },
    doctor: { type: String },
    notes: { type: String },
    icd10Code: { type: String },
    attachments: [{ type: String }],
  },
  { _id: true, timestamps: true }
);


const documentSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileSizeBytes: { type: Number },
    mimeType: { type: String },
    uploadDate: { type: Date, default: Date.now },
    type: {
      type: String,
      enum: ['Report', 'Scan', 'Prescription', 'Lab Result', 'Discharge Summary', 'Insurance', 'Other'],
      default: 'Report',
    },
    uploadedBy: { type: String, default: 'self' },
    description: { type: String },
  },
  { _id: true, timestamps: true }
);

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String },
    relationship: { type: String },
    phone: { type: String },
    email: { type: String },
  },
  { _id: false }
);

const auditEntrySchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now, index: true },
    accessedBy: { type: String },
    accessedByRole: { type: String, enum: ['patient', 'doctor', 'admin', 'system'], required: true },
    action: { type: String, required: true },
    resource: { type: String },
    ipAddress: { type: String },
  },
  { _id: true }
);

// ─── Main Patient schema ──────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const patientSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: { validator: (v) => EMAIL_REGEX.test(v), message: 'Invalid email format' },
    },
    password: { type: String, required: true },
    phone: { type: String, trim: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    address: { type: String },
    nationalId: { type: String, trim: true },
    photoUrl: { type: String },

    bloodType: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''] },
    allergies: { type: [allergySchema], default: [] },
    chronicConditions: { type: [chronicConditionSchema], default: [] },

    emergencyContact: { type: emergencyContactSchema, default: () => ({}) },
    insurance: { type: insuranceSchema, default: () => ({}) },

    vitalSigns: { type: [vitalSignSchema], default: [] },
    vaccinations: { type: [vaccinationSchema], default: [] },
    familyHistory: { type: [familyHistorySchema], default: [] },

    medicalHistory: { type: [medicalRecordSchema], default: [] },
    documents: { type: [documentSchema], default: [] },

    auditLog: { type: [auditEntrySchema], default: [], select: false },

    accountStatus: { type: String, enum: ['active', 'suspended', 'deactivated'], default: 'active' },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

patientSchema.index({ firstName: 'text', lastName: 'text', email: 'text' });
patientSchema.index({ accountStatus: 1, createdAt: -1 });

patientSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.auditLog;
  return obj;
};

patientSchema.methods.computeHealthScore = function () {
  let score = 100;
  if (this.allergies.some((a) => ['severe', 'life-threatening'].includes(a.severity))) score -= 10;
  score -= this.chronicConditions.filter((c) => c.status === 'active').length * 5;
  const recentVitals = (this.vitalSigns || []).slice(-1)[0];
  if (recentVitals) {
    if (recentVitals.bmi && (recentVitals.bmi < 18.5 || recentVitals.bmi > 30)) score -= 5;
    if (recentVitals.bloodPressureSystolic > 140 || recentVitals.bloodPressureDiastolic > 90) score -= 8;
    if (recentVitals.heartRateBpm && (recentVitals.heartRateBpm < 50 || recentVitals.heartRateBpm > 100)) score -= 5;
    if (recentVitals.oxygenSaturation && recentVitals.oxygenSaturation < 95) score -= 10;
  }
  return Math.max(0, Math.min(100, score));
};

module.exports = mongoose.model('Patient', patientSchema);
