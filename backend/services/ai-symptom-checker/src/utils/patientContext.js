const axios = require('axios');
const SymptomCheck = require('../models/SymptomCheck');

const PATIENT_SERVICE_URL =
  process.env.PATIENT_SERVICE_URL || 'http://patient-management:3001/api/patients';
const DOCTOR_SERVICE_URL =
  process.env.DOCTOR_SERVICE_URL || 'http://doctor-management:3002/api/doctors';

/**
 * Fetch a condensed clinical context for the patient, used to enrich the LLM prompt.
 * Failures are tolerated — returns null so the symptom check can still proceed.
 */
async function fetchPatientContext(patientId, authHeader) {
  if (!patientId || !authHeader) return null;
  try {
    const { data } = await axios.get(`${PATIENT_SERVICE_URL}/${patientId}/summary`, {
      headers: { Authorization: authHeader },
      timeout: 4000,
    });
    return data;
  } catch (err) {
    console.warn('[ai] patient-context lookup failed:', err.response?.status || err.message);
    return null;
  }
}

/**
 * #7 Deeper history fetch — pulls medical history (surgeries, admissions),
 * family history, and demographic profile (occupation if recorded). Used by
 * the narrative endpoint and to enrich the triage prompt.
 */
async function fetchDeepHistory(patientId, authHeader) {
  if (!patientId || !authHeader) return null;
  try {
    const { data } = await axios.get(`${PATIENT_SERVICE_URL}/${patientId}/full`, {
      headers: { Authorization: authHeader },
      timeout: 5000,
    });
    return data;
  } catch (err) {
    console.warn('[ai] deep-history lookup failed:', err.response?.status || err.message);
    return null;
  }
}

/**
 * Active-prescription list, used for drug-interaction cross-checks.
 */
async function fetchActivePrescriptions(patientId, authHeader) {
  if (!patientId || !authHeader) return [];
  try {
    const { data } = await axios.get(`${PATIENT_SERVICE_URL}/${patientId}/records`, {
      headers: { Authorization: authHeader },
      timeout: 4000,
    });
    return (data?.prescriptions || []).filter((p) => p.active !== false);
  } catch (err) {
    console.warn('[ai] prescription lookup failed:', err.response?.status || err.message);
    return [];
  }
}

/**
 * #6 Recent symptom checks for this patient — last N within the past
 * `windowDays`. Used to feed progression context into the prompt.
 */
async function fetchRecentChecks(patientId, { limit = 5, windowDays = 14 } = {}) {
  if (!patientId) return [];
  try {
    const since = new Date(Date.now() - windowDays * 24 * 3600 * 1000);
    return await SymptomCheck.find({
      patientId,
      timestamp: { $gte: since },
    })
      .sort({ timestamp: -1 })
      .limit(limit)
      .select('symptoms overallUrgency aiSummary timestamp')
      .lean();
  } catch (err) {
    console.warn('[ai] recent-checks lookup failed:', err.message);
    return [];
  }
}

/**
 * Verified doctors of a given specialty + their next available slot (best-effort).
 */
async function fetchVerifiedDoctorsBySpecialty(specialty, authHeader, max = 3) {
  if (!specialty) return [];
  try {
    const { data } = await axios.get(`${DOCTOR_SERVICE_URL}`, {
      params: { specialty },
      headers: authHeader ? { Authorization: authHeader } : {},
      timeout: 4000,
    });
    const doctors = Array.isArray(data) ? data : [];
    return doctors
      .filter((d) => d.isVerified !== false)
      .slice(0, max)
      .map((d) => ({
        doctorId: d._id,
        name: d.name,
        specialty: d.specialty,
        isVerified: d.isVerified,
        consultationFee: d.consultationFee,
        nextSlot: nextSlotFromAvailability(d.availability),
      }));
  } catch (err) {
    console.warn('[ai] doctor lookup failed:', err.response?.status || err.message);
    return [];
  }
}

function nextSlotFromAvailability(availability) {
  if (!Array.isArray(availability) || availability.length === 0) return null;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + i);
    const slot = availability.find((a) => a.day === days[candidate.getDay()] && !a.isBooked);
    if (slot) {
      return `${candidate.toISOString().split('T')[0]} ${slot.startTime}–${slot.endTime}`;
    }
  }
  return null;
}

module.exports = {
  fetchPatientContext,
  fetchDeepHistory,
  fetchActivePrescriptions,
  fetchRecentChecks,
  fetchVerifiedDoctorsBySpecialty,
};
