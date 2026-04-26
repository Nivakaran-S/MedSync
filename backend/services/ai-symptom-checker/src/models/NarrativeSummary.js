const mongoose = require('mongoose');

// #8 AI narrative summary cache — paragraph-form synthesis of a patient's
// chronic health picture. Cached for 24h via Mongo TTL to avoid repeated
// LLM calls for the same patient.

const narrativeSummarySchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true, unique: true, index: true },
    summary: { type: String, required: true },
    sourceModel: { type: String },
    promptVersion: { type: String },
    language: { type: String, default: 'en' },
    generatedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 }, // 24h TTL
  },
  { timestamps: true }
);

module.exports = mongoose.model('NarrativeSummary', narrativeSummarySchema);
