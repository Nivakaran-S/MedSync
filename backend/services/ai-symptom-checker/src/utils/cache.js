// #17 Query cache helper. Hashes the (anonymised) input and either returns
// a cached payload or runs the producer fn and stores the result.

const crypto = require('crypto');
const AnalysisCache = require('../models/AnalysisCache');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

/**
 * Build the cache key for an analysis input. PatientId intentionally excluded
 * so the cache is reusable across users with the same symptoms.
 */
function buildKey({ symptoms, severity, durationDays, bodyLocation, additionalContext, language, model, promptVersion }) {
  const norm = JSON.stringify({
    symptoms: String(symptoms || '').trim().toLowerCase(),
    severity: severity || 'unspecified',
    durationDays: durationDays || 0,
    bodyLocation: (bodyLocation || '').trim().toLowerCase(),
    additionalContext: (additionalContext || '').trim().toLowerCase(),
    language: language || 'en',
    model: model || '',
    promptVersion: promptVersion || '',
  });
  return sha256(norm);
}

async function get(key) {
  try {
    const row = await AnalysisCache.findOne({ inputHash: key });
    if (!row) return null;
    // Increment hit count (fire and forget).
    AnalysisCache.updateOne({ _id: row._id }, { $inc: { hitCount: 1 } }).catch(() => {});
    return row.payload;
  } catch (err) {
    console.warn('[ai/cache] get failed:', err.message);
    return null;
  }
}

async function set(key, payload, meta = {}) {
  try {
    await AnalysisCache.findOneAndUpdate(
      { inputHash: key },
      {
        $set: {
          inputHash: key,
          payload,
          sourceModel: meta.sourceModel,
          promptVersion: meta.promptVersion,
          language: meta.language || 'en',
          cachedAt: new Date(),
        },
      },
      { upsert: true }
    );
  } catch (err) {
    console.warn('[ai/cache] set failed:', err.message);
  }
}

module.exports = { buildKey, get, set };
