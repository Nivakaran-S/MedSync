const mongoose = require('mongoose');

// #17 Query cache — hash of (anonymised) input → cached LLM response.
// Cached for 7 days via Mongo TTL. Patient context is intentionally NOT in
// the hash so the cache is reusable across users with the same symptoms.
//
// We never cache emergency-level outputs (the controller skips cache hits
// for those, just to be safe).

const analysisCacheSchema = new mongoose.Schema(
  {
    inputHash: { type: String, required: true, unique: true, index: true },
    sourceModel: { type: String },
    promptVersion: { type: String },
    language: { type: String, default: 'en' },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    hitCount: { type: Number, default: 0 },
    cachedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 }, // 7 days
  },
  { timestamps: true }
);

module.exports = mongoose.model('AnalysisCache', analysisCacheSchema);
