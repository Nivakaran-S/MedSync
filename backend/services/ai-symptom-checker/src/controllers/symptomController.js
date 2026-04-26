const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const SymptomCheck = require('../models/SymptomCheck');
const SymptomCheckFeedback = require('../models/SymptomCheckFeedback');
const Conversation = require('../models/Conversation');
const PromptVersion = require('../models/PromptVersion');
const NarrativeSummary = require('../models/NarrativeSummary');
const { sendEvent } = require('../utils/kafka');
const {
  fetchPatientContext,
  fetchDeepHistory,
  fetchActivePrescriptions,
  fetchRecentChecks,
  fetchVerifiedDoctorsBySpecialty,
} = require('../utils/patientContext');
const { detectRedFlags } = require('../utils/redFlags');
const { deriveSeverity } = require('../utils/severityNLP');
const { detectSideEffects } = require('../utils/drugSymptoms');
const { suggestICD10 } = require('../utils/icd10');
const { renderPrompt } = require('../utils/prompts');
const cache = require('../utils/cache');

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

// #18 Cheaper-model fallback chain — try Flash first for low-complexity inputs;
// escalate to Pro if confidence is below threshold.
const MODEL_PRO = 'gemini-1.5-pro';
const MODEL_FLASH = 'gemini-1.5-flash';
const MODEL_VISION = 'gemini-1.5-pro';
const FALLBACK_CONFIDENCE_THRESHOLD = Number(process.env.SYMPTOM_FLASH_ESCALATE_THRESHOLD) || 0.65;

// ─── Local fallback knowledge base ────────────────────────────────────────────
const symptomMappings = [
  { keywords: ['chest pain', 'palpitations', 'shortness of breath', 'heart racing', 'tightness in chest'], specialty: 'Cardiologist', urgency: 'high', suggestions: 'Avoid strenuous activity. Seek emergency care if pain radiates to arm/jaw or persists.' },
  { keywords: ['cough', 'fever', 'sore throat', 'cold', 'flu', 'runny nose', 'body aches', 'chills'], specialty: 'General Physician', urgency: 'low', suggestions: 'Rest, hydrate, monitor temperature. See a doctor if fever exceeds 39°C or symptoms persist beyond 3 days.' },
  { keywords: ['rash', 'itching', 'skin', 'redness', 'acne', 'eczema', 'hives', 'blisters'], specialty: 'Dermatologist', urgency: 'low', suggestions: 'Avoid scratching; keep area clean and dry. Consult a dermatologist for diagnosis.' },
  { keywords: ['headache', 'dizziness', 'seizure', 'numbness', 'tingling', 'memory loss', 'confusion', 'fainting'], specialty: 'Neurologist', urgency: 'medium', suggestions: 'Track frequency and intensity. Seek emergency care for sudden severe headache or loss of consciousness.' },
  { keywords: ['stomach pain', 'nausea', 'vomiting', 'bloating', 'diarrhea', 'constipation', 'acid reflux', 'heartburn'], specialty: 'Gastroenterologist', urgency: 'medium', suggestions: 'Light bland meals, hydrate. Seek immediate care if blood appears in stool or vomit.' },
  { keywords: ['joint pain', 'back pain', 'muscle ache', 'fracture', 'sprain', 'swelling in joints', 'stiffness'], specialty: 'Orthopedic', urgency: 'medium', suggestions: 'Cold/warm compress. Avoid heavy lifting. See a doctor if pain is severe or post-injury.' },
  { keywords: ['ear pain', 'hearing loss', 'tinnitus', 'sinus', 'nasal congestion', 'nosebleed', 'throat infection', 'hoarseness'], specialty: 'ENT Specialist', urgency: 'low', suggestions: 'Saline nasal sprays for congestion. Consult an ENT for persistent issues.' },
  { keywords: ['blurred vision', 'eye pain', 'red eyes', 'watery eyes', 'vision loss', 'floaters', 'sensitivity to light'], specialty: 'Ophthalmologist', urgency: 'medium', suggestions: 'Rest eyes. Sudden vision changes need immediate ophthalmology review.' },
  { keywords: ['anxiety', 'depression', 'insomnia', 'panic attacks', 'mood swings', 'stress', 'suicidal thoughts', 'hallucinations'], specialty: 'Psychiatrist', urgency: 'high', suggestions: 'Reach out to a mental-health professional. For suicidal thoughts contact a crisis line immediately.' },
  { keywords: ['urinary pain', 'frequent urination', 'blood in urine', 'kidney pain', 'urinary incontinence'], specialty: 'Urologist', urgency: 'medium', suggestions: 'Increase water intake; avoid caffeine. Blood in urine warrants urgent attention.' },
  { keywords: ['wheezing', 'asthma', 'persistent cough', 'difficulty breathing', 'bronchitis', 'chest congestion'], specialty: 'Pulmonologist', urgency: 'high', suggestions: 'Avoid smoke/dust/allergens. Use inhaler if prescribed; seek emergency care if breathing is severely impaired.' },
  { keywords: ['diabetes', 'excessive thirst', 'frequent hunger', 'weight changes', 'thyroid', 'hormonal imbalance', 'fatigue'], specialty: 'Endocrinologist', urgency: 'medium', suggestions: 'Monitor blood sugar; balanced diet and regular exercise.' },
  { keywords: ['severe bleeding', 'unconscious', 'stroke', 'heart attack', 'poisoning', 'choking', 'anaphylaxis', 'severe burn'], specialty: 'Emergency Medicine', urgency: 'emergency', suggestions: 'CALL EMERGENCY SERVICES IMMEDIATELY (1990 in Sri Lanka, 911 in US). Do not delay.' },
];

const urgencyOrder = { low: 0, medium: 1, high: 2, emergency: 3 };
const highest = (arr) => arr.reduce((acc, m) => (urgencyOrder[m.urgency] > urgencyOrder[acc] ? m.urgency : acc), 'low');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const stripJSON = (raw) => raw.replace(/```json/gi, '').replace(/```/g, '').trim();

const buildContextBlock = (patientCtx, prescriptions, deepHistory) => {
  const lines = ['', 'PATIENT CLINICAL CONTEXT:'];
  if (patientCtx) {
    const p = patientCtx.patient || {};
    if (p.dateOfBirth) {
      const age = Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / 31557600000);
      lines.push(`- Age: ${age} (${p.gender || 'unspecified gender'})`);
    }
    if (p.bloodType) lines.push(`- Blood type: ${p.bloodType}`);
    if (patientCtx.criticalAllergies?.length) {
      lines.push(`- CRITICAL allergies: ${patientCtx.criticalAllergies.map((a) => `${a.substance} (${a.severity})`).join(', ')}`);
    }
    if (patientCtx.activeChronicConditions?.length) {
      lines.push(`- Active chronic conditions: ${patientCtx.activeChronicConditions.map((c) => c.name).join(', ')}`);
    }
    if (prescriptions?.length) {
      lines.push(`- Active medications: ${prescriptions.map((p) => `${p.medication} ${p.dosage || ''}`.trim()).join(', ')}`);
    }
    if (patientCtx.lastVitals?.length) {
      const v = patientCtx.lastVitals[0];
      const vbits = [];
      if (v.bloodPressureSystolic) vbits.push(`BP ${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}`);
      if (v.heartRateBpm) vbits.push(`HR ${v.heartRateBpm}`);
      if (v.temperatureC) vbits.push(`Temp ${v.temperatureC}°C`);
      if (v.oxygenSaturation) vbits.push(`SpO₂ ${v.oxygenSaturation}%`);
      if (vbits.length) lines.push(`- Latest vitals: ${vbits.join(', ')}`);
    }
  }
  // #7 Deep history fold-in
  if (deepHistory) {
    const hist = (deepHistory.medicalHistory || []).slice(-5);
    if (hist.length) {
      lines.push(`- Recent medical history: ${hist.map((h) => `${h.diagnosis || h.description} (${h.date ? new Date(h.date).getFullYear() : '?'})`).join('; ')}`);
    }
    const fam = (deepHistory.familyHistory || []).slice(0, 5);
    if (fam.length) {
      lines.push(`- Family history: ${fam.map((f) => `${f.relation} → ${f.condition}`).join('; ')}`);
    }
  }
  return lines.length > 1 ? lines.join('\n') : '';
};

const buildProgressionBlock = (recentChecks) => {
  if (!Array.isArray(recentChecks) || recentChecks.length === 0) return '';
  const lines = ['', 'RECENT SYMPTOM CHECK HISTORY (most recent first):'];
  for (const c of recentChecks.slice(0, 5)) {
    const d = c.timestamp ? new Date(c.timestamp).toISOString().slice(0, 10) : '?';
    lines.push(`- [${d}] urgency=${c.overallUrgency || 'unknown'} | symptoms: ${String(c.symptoms || '').slice(0, 120)}`);
  }
  return lines.join('\n');
};

const buildRedFlagBlock = (redFlags) => {
  if (!redFlags || redFlags.length === 0) return '';
  const lines = ['', 'RED FLAG CLUSTERS DETECTED (escalate to emergency unless ruled out):'];
  for (const r of redFlags) lines.push(`- ${r.label} (${r.code})`);
  return lines.join('\n');
};

const fallbackAnalyse = (input) => {
  const matched = [];
  for (const m of symptomMappings) {
    const hits = m.keywords.filter((k) => input.includes(k));
    if (hits.length > 0) {
      matched.push({
        specialty: m.specialty,
        suggestions: m.suggestions,
        urgency: m.urgency,
        matchedKeywords: hits,
        confidence: Math.min(0.9, 0.4 + hits.length * 0.15),
      });
    }
  }
  if (matched.length === 0) {
    matched.push({
      specialty: 'General Physician',
      suggestions: 'Consult a General Physician for a thorough evaluation.',
      urgency: 'low',
      matchedKeywords: [],
      confidence: 0.3,
    });
  }
  const overallUrgency = highest(matched);
  return {
    aiSummary: 'Preliminary assessment based on local keyword matching (AI service unavailable).',
    overallUrgency,
    overallConfidence: 0.4,
    results: matched,
    drugInteractionWarnings: [],
    allergyWarnings: [],
  };
};

// #18 Run the LLM — Flash first, escalate to Pro if confidence is low.
async function runLlmWithFallback(promptText) {
  if (!genAI) throw new Error('GEMINI_API_KEY not configured');

  // First attempt: Flash (cheaper).
  try {
    const flash = genAI.getGenerativeModel({ model: MODEL_FLASH });
    const flashResult = await flash.generateContent(promptText);
    const parsed = JSON.parse(stripJSON(flashResult.response.text()));
    const confidence = typeof parsed.overallConfidence === 'number' ? parsed.overallConfidence : 0;
    if (confidence >= FALLBACK_CONFIDENCE_THRESHOLD && parsed.overallUrgency !== 'emergency') {
      return { analysis: parsed, model: MODEL_FLASH, escalated: false };
    }
    // Low confidence or emergency-marked → re-ask Pro to confirm.
    const pro = genAI.getGenerativeModel({ model: MODEL_PRO });
    const proResult = await pro.generateContent(promptText);
    const proParsed = JSON.parse(stripJSON(proResult.response.text()));
    return { analysis: proParsed, model: MODEL_PRO, escalated: true };
  } catch (err) {
    // If Flash itself fails, fall back to Pro directly.
    console.warn('[ai] Flash call failed, retrying with Pro:', err.message);
    const pro = genAI.getGenerativeModel({ model: MODEL_PRO });
    const proResult = await pro.generateContent(promptText);
    const proParsed = JSON.parse(stripJSON(proResult.response.text()));
    return { analysis: proParsed, model: MODEL_PRO, escalated: false };
  }
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

exports.analyzeSymptoms = async (req, res) => {
  try {
    const {
      symptoms, severity = 'unspecified', durationDays, bodyLocation, additionalContext,
      language = 'en',
    } = req.body;
    if (!symptoms || !symptoms.trim()) {
      return res.status(400).json({ message: 'Symptoms are required' });
    }

    const patientId = req.user?.patientId || req.body.patientId || null;
    const authHeader = req.headers.authorization;

    // ── #1 Red-flag detection (runs locally — independent of LLM) ──────────
    const fullText = [symptoms, additionalContext].filter(Boolean).join(' ');
    const { clusters: redFlags, hit: hasRedFlag } = detectRedFlags(fullText);

    // ── #3 NLP severity scoring ────────────────────────────────────────────
    const { impliedSeverity, mismatch: severityMismatch, mismatchNote: severityMismatchNote } = deriveSeverity(fullText, severity);

    // Pull patient context, active prescriptions, deep history, and recent
    // checks in parallel (all best-effort).
    const [patientCtx, activePrescriptions, deepHistory, recentChecks] = await Promise.all([
      patientId ? fetchPatientContext(patientId, authHeader) : Promise.resolve(null),
      patientId ? fetchActivePrescriptions(patientId, authHeader) : Promise.resolve([]),
      patientId ? fetchDeepHistory(patientId, authHeader) : Promise.resolve(null),
      patientId ? fetchRecentChecks(patientId) : Promise.resolve([]),
    ]);

    // #5 Drug-symptom side-effect cross-check
    const possibleDrugSideEffects = detectSideEffects(fullText, activePrescriptions);

    // ── Build prompt via the version registry (#16) ────────────────────────
    const contextBlock = buildContextBlock(patientCtx, activePrescriptions, deepHistory);
    const progressionBlock = buildProgressionBlock(recentChecks);
    const redFlagBlock = buildRedFlagBlock(redFlags);
    const { text: promptText, version: promptVersion } = await renderPrompt('triage', {
      symptoms,
      severity,
      durationDays: durationDays ?? 'unspecified',
      bodyLocation: bodyLocation || 'unspecified',
      additionalContext: additionalContext || 'none',
      contextBlock,
      progressionBlock,
      redFlagBlock,
      language,
    });

    // ── #17 Cache lookup (skip if patient context is present, since we can't
    //    safely reuse personalised results across patients) ────────────────
    const canCache = !patientCtx && !hasRedFlag;
    const cacheKey = canCache
      ? cache.buildKey({ symptoms, severity, durationDays, bodyLocation, additionalContext, language, promptVersion, model: 'auto' })
      : null;
    let analysis;
    let modelUsed;
    let cacheHit = false;
    if (cacheKey) {
      const cached = await cache.get(cacheKey);
      if (cached) {
        analysis = cached.analysis;
        modelUsed = cached.sourceModel;
        cacheHit = true;
      }
    }

    if (!analysis) {
      if (genAI) {
        try {
          const r = await runLlmWithFallback(promptText);
          analysis = r.analysis;
          modelUsed = r.model;
        } catch (aiErr) {
          console.warn('[ai] LLM call failed, using local fallback:', aiErr.message);
          analysis = fallbackAnalyse(symptoms.toLowerCase());
          modelUsed = 'local-fallback';
        }
      } else {
        analysis = fallbackAnalyse(symptoms.toLowerCase());
        modelUsed = 'local-fallback';
      }

      if (cacheKey) {
        cache.set(cacheKey, { analysis }, { sourceModel: modelUsed, promptVersion, language }).catch(() => {});
      }
    }

    // ── A2: Confidence threshold gating ────────────────────────────────────
    const CONFIDENCE_THRESHOLD = Number(process.env.SYMPTOM_CONFIDENCE_THRESHOLD) || 0.6;
    const rawConfidence = typeof analysis.overallConfidence === 'number' ? analysis.overallConfidence : 0.5;
    const rawUrgency = analysis.overallUrgency || 'low';
    const isLowConfidence = rawConfidence < CONFIDENCE_THRESHOLD;
    let finalUrgency = isLowConfidence && urgencyOrder[rawUrgency] < urgencyOrder.high ? 'high' : rawUrgency;
    const confidenceFlag = isLowConfidence ? 'LOW' : 'OK';

    // ── #1 / #4 Red-flag override — clusters always escalate to emergency.
    let urgencyOverrideReason = null;
    if (hasRedFlag) {
      finalUrgency = 'emergency';
      urgencyOverrideReason = `Red flag(s) detected: ${redFlags.map((r) => r.code).join(', ')}`;
    }

    // ── #3 Severity mismatch can also nudge urgency upward ─────────────────
    if (severityMismatch && urgencyOrder[finalUrgency] < urgencyOrder.medium) {
      finalUrgency = 'medium';
      urgencyOverrideReason = urgencyOverrideReason
        || 'Self-reported severity is much lower than the language used — escalated as a precaution.';
    }

    // Recommend doctors for the top specialty
    const topSpecialty = analysis.results?.[0]?.specialty;
    const recommendedDoctors = topSpecialty
      ? await fetchVerifiedDoctorsBySpecialty(topSpecialty, authHeader)
      : [];

    // ── B5: Follow-up scheduling ───────────────────────────────────────────
    const followUpAt = (() => {
      if (finalUrgency === 'high') return new Date(Date.now() + 24 * 3600 * 1000);
      if (finalUrgency === 'medium') return new Date(Date.now() + 48 * 3600 * 1000);
      return null;
    })();

    // ── #13 ICD-10 mapping per result ──────────────────────────────────────
    const enrichedResults = (analysis.results || []).map((r) => ({
      specialty: r.specialty,
      suggestions: r.suggestions,
      urgency: r.urgency,
      matchedKeywords: r.matchedKeywords || [],
      confidence: typeof r.confidence === 'number' ? r.confidence : 0.5,
      icd10Codes: suggestICD10(r.specialty, `${r.suggestions || ''} ${(r.matchedKeywords || []).join(' ')}`),
      demographicNote: r.demographicNote || undefined,
    }));

    // ── #6 Progression analysis (LLM may include it; fall back to "unknown") ─
    const progression = analysis.progressionAnalysis
      ? {
          trend: analysis.progressionAnalysis.trend || 'unknown',
          explanation: analysis.progressionAnalysis.explanation,
          referenceCheckIds: recentChecks.map((c) => String(c._id)),
        }
      : null;

    // Persist
    const check = new SymptomCheck({
      patientId,
      symptoms: symptoms.toLowerCase(),
      severity,
      durationDays,
      bodyLocation,
      additionalContext,
      language,
      aiSummary: analysis.aiSummary,
      results: enrichedResults,
      overallUrgency: finalUrgency,
      overallConfidence: rawConfidence,
      confidenceFlag,
      followUpAt,
      drugInteractionWarnings: analysis.drugInteractionWarnings || [],
      allergyWarnings: analysis.allergyWarnings || [],
      possibleDrugSideEffects,
      redFlags,
      urgencyOverrideReason,
      impliedSeverity,
      severityMismatchNote,
      progression,
      recommendedDoctors,
      sourceModel: modelUsed,
      promptVersion,
    });
    await check.save();

    // Always emit the routine event
    await sendEvent('symptom-events', {
      type: 'SYMPTOM_CHECK_PERFORMED',
      checkId: check._id,
      symptoms: check.symptoms,
      detectedSpecialties: check.results.map((r) => r.specialty),
      urgency: check.overallUrgency,
      patientId,
      timestamp: new Date(),
    });

    // Emergency? Page the patient's emergency contact.
    if (check.overallUrgency === 'emergency') {
      check.emergencyAlertSent = true;
      await check.save();
      await sendEvent('symptom-events', {
        type: 'EMERGENCY_TRIAGE_ALERT',
        data: {
          checkId: check._id,
          patientId,
          patientName: patientCtx?.patient?.name || patientCtx?.profile?.firstName,
          patientEmail: patientCtx?.profile?.email,
          patientPhone: patientCtx?.profile?.phone,
          emergencyContact: patientCtx?.profile?.emergencyContact,
          symptoms: check.symptoms,
          summary: check.aiSummary,
          urgency: check.overallUrgency,
          redFlags,
          timestamp: new Date(),
        },
      });
    }

    // B5: schedule a follow-up reminder if applicable.
    if (followUpAt && patientId) {
      await sendEvent('wellness-events', {
        type: 'SYMPTOM_CHECK_FOLLOWUP_SCHEDULED',
        data: {
          checkId: check._id,
          patientId,
          patientEmail: patientCtx?.profile?.email,
          fireAt: followUpAt,
          urgencyAtCheck: check.overallUrgency,
          summary: check.aiSummary,
        },
      });
    }

    // ── A3: Disclaimers + transparency ─────────────────────────────────────
    const disclaimers = [
      { type: 'not-a-diagnosis', text: 'This is a preliminary AI suggestion, not a diagnosis. Always consult a qualified healthcare professional.' },
      { type: 'model-info', text: `Generated by ${check.sourceModel}${cacheHit ? ' (cached result)' : ''}. AI models can make mistakes — consider getting a second opinion for serious symptoms.` },
      { type: 'emergency-reminder', text: 'If you are experiencing a medical emergency, call your local emergency number immediately.' },
    ];
    if (confidenceFlag === 'LOW') {
      disclaimers.push({
        type: 'low-confidence',
        text: `The model's confidence in this triage is low (${Math.round(rawConfidence * 100)}%). Urgency has been escalated as a precaution. Please verify with a clinician before acting on these recommendations.`,
      });
    }
    if (hasRedFlag) {
      disclaimers.push({
        type: 'red-flag',
        text: `Possible high-risk presentation detected: ${redFlags.map((r) => r.label).join(', ')}. ${redFlags[0].advice}`,
      });
    }
    if (severityMismatch && severityMismatchNote) {
      disclaimers.push({ type: 'severity-mismatch', text: severityMismatchNote });
    }
    if (possibleDrugSideEffects.length > 0) {
      for (const w of possibleDrugSideEffects) {
        disclaimers.push({
          type: 'drug-side-effect',
          text: `${w.note} (${w.drug}). ${w.advice}`,
        });
      }
    }

    res.status(200).json({
      results: check.results,
      overallUrgency: check.overallUrgency,
      overallConfidence: check.overallConfidence,
      confidenceFlag: check.confidenceFlag,
      aiSummary: check.aiSummary,
      drugInteractionWarnings: check.drugInteractionWarnings,
      allergyWarnings: check.allergyWarnings,
      possibleDrugSideEffects: check.possibleDrugSideEffects,
      redFlags: check.redFlags,
      urgencyOverrideReason: check.urgencyOverrideReason,
      impliedSeverity: check.impliedSeverity,
      severityMismatchNote: check.severityMismatchNote,
      progression: check.progression,
      recommendedDoctors: check.recommendedDoctors,
      contextUsed: !!patientCtx,
      checkId: check._id,
      sourceModel: check.sourceModel,
      promptVersion: check.promptVersion,
      cacheHit,
      followUpAt: check.followUpAt,
      language: check.language,
      disclaimers,
      disclaimer: disclaimers[0].text, // legacy field
    });
  } catch (error) {
    console.error('[ai] analyze error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── Image analysis (Gemini Vision) — #11 extended kinds ─────────────────────

const IMAGE_KIND_DISCLAIMERS = {
  skin:        'Visual inspection only — not a diagnosis. A dermatologist should review for confirmation.',
  rash:        'Visual inspection only — not a diagnosis. A dermatologist should review for confirmation.',
  wound:       'Visual inspection only — not a diagnosis. Seek immediate care if signs of infection (red streaks, fever, pus).',
  'lab-report':'Extracted values are AI-read and may contain OCR errors. Always confirm with the printed report and your doctor.',
  xray:        'PRELIMINARY VISUAL SCAN ONLY — NOT a radiologist report. Findings must be reviewed by a qualified radiologist before any clinical decision.',
  ecg:         'PRELIMINARY VISUAL SCAN ONLY — NOT an ECG interpretation. Findings must be reviewed by a qualified cardiologist before any clinical decision.',
  other:       'Preliminary visual scan only. Always discuss findings with a qualified clinician.',
};

exports.analyzeImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'An image file is required' });
    if (!genAI) return res.status(503).json({ message: 'AI vision service is not configured' });

    const { description = '', language = 'en', imageKind = 'skin' } = req.body;
    const safeKind = IMAGE_KIND_DISCLAIMERS[imageKind] ? imageKind : 'other';
    const patientId = req.user?.patientId || req.body.patientId || null;

    const buffer = fs.readFileSync(req.file.path);
    const inlineData = { data: buffer.toString('base64'), mimeType: req.file.mimetype };

    const model = genAI.getGenerativeModel({ model: MODEL_VISION });
    const { text: promptText, version: promptVersion } = await renderPrompt('image', {
      imageKind: safeKind,
      description,
      language,
    });

    const ai = await model.generateContent([{ inlineData }, promptText]);
    const parsed = JSON.parse(stripJSON(ai.response.text()));

    // For X-rays / ECGs, NEVER trust the model with low urgency — set a floor of medium.
    let overallUrgency = parsed.overallUrgency || 'low';
    if ((safeKind === 'xray' || safeKind === 'ecg') && urgencyOrder[overallUrgency] < urgencyOrder.medium) {
      overallUrgency = 'medium';
    }

    const enrichedResults = (parsed.results || []).map((r) => ({
      specialty: r.specialty,
      suggestions: r.suggestions,
      urgency: r.urgency,
      confidence: r.confidence,
      matchedKeywords: parsed.visibleFindings || [],
      icd10Codes: suggestICD10(r.specialty, `${r.suggestions || ''}`),
    }));

    const check = new SymptomCheck({
      patientId,
      symptoms: description || `[image-only consultation: ${safeKind}]`,
      additionalContext: `image upload (${safeKind})`,
      language,
      aiSummary: parsed.aiSummary,
      results: enrichedResults,
      overallUrgency,
      overallConfidence: parsed.overallConfidence || 0.5,
      imageAnalyzed: true,
      imageKind: safeKind,
      sourceModel: MODEL_VISION,
      promptVersion,
    });
    await check.save();

    fs.unlink(req.file.path, () => {});

    await sendEvent('symptom-events', {
      type: 'SYMPTOM_IMAGE_ANALYZED',
      checkId: check._id,
      urgency: check.overallUrgency,
      imageKind: safeKind,
      patientId,
      timestamp: new Date(),
    });

    res.status(200).json({
      results: check.results,
      overallUrgency: check.overallUrgency,
      overallConfidence: check.overallConfidence,
      aiSummary: check.aiSummary,
      visibleFindings: parsed.visibleFindings || [],
      extractedValues: parsed.extractedValues || [],
      checkId: check._id,
      imageKind: safeKind,
      sourceModel: check.sourceModel,
      promptVersion: check.promptVersion,
      disclaimers: [
        { type: 'image-kind-warning', text: IMAGE_KIND_DISCLAIMERS[safeKind] },
        { type: 'not-a-diagnosis', text: 'Preliminary AI suggestion only — not a diagnosis.' },
      ],
    });
  } catch (error) {
    console.error('[ai] image analyze error:', error);
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    res.status(500).json({ message: error.message });
  }
};

// ─── Multi-turn follow-up conversation ────────────────────────────────────────

exports.startConversation = async (req, res) => {
  try {
    const { initialMessage } = req.body;
    if (!initialMessage) return res.status(400).json({ message: 'initialMessage is required' });

    const conversation = new Conversation({
      patientId: req.user?.patientId || null,
      messages: [
        { role: 'system', content: 'MedSync clinical triage assistant — concise, empathetic, safety-first.' },
        { role: 'user', content: initialMessage },
      ],
    });

    const reply = await runConversation(conversation);
    conversation.messages.push({ role: 'assistant', content: reply });
    await conversation.save();

    res.status(201).json({ conversationId: conversation._id, reply });
  } catch (error) {
    console.error('[ai] startConversation error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.continueConversation = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: 'message is required' });

    const convo = await Conversation.findById(req.params.id);
    if (!convo) return res.status(404).json({ message: 'Conversation not found' });
    if (convo.status === 'closed') return res.status(400).json({ message: 'Conversation is closed' });

    if (req.user?.role === 'patient' && convo.patientId && convo.patientId !== req.user.patientId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    convo.messages.push({ role: 'user', content: message });
    const reply = await runConversation(convo);
    convo.messages.push({ role: 'assistant', content: reply });
    await convo.save();

    res.status(200).json({ reply, messageCount: convo.messages.length });
  } catch (error) {
    console.error('[ai] continueConversation error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.closeConversation = async (req, res) => {
  try {
    const convo = await Conversation.findById(req.params.id);
    if (!convo) return res.status(404).json({ message: 'Conversation not found' });
    convo.status = 'closed';
    convo.closedAt = new Date();
    await convo.save();
    res.status(200).json({ message: 'Closed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.listConversations = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'patient') filter.patientId = req.user.patientId;
    else if (req.params.patientId) filter.patientId = req.params.patientId;

    const items = await Conversation.find(filter)
      .sort({ updatedAt: -1 })
      .limit(50)
      .select('title status updatedAt finalUrgency messages');
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

async function runConversation(convo) {
  if (!genAI) {
    return 'AI is not currently available. Please consult a general physician for evaluation.';
  }
  try {
    const model = genAI.getGenerativeModel({ model: MODEL_PRO });
    const history = convo.messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');
    const prompt = `${history}\n\nASSISTANT: (reply concisely, ask one focused follow-up question if needed, escalate to "EMERGENCY — call 1990" only if life-threatening)`;
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  } catch (err) {
    console.warn('[ai] runConversation error:', err.message);
    return 'I could not generate a response right now. If this is urgent, please contact your healthcare provider.';
  }
}

// ─── History & analytics ──────────────────────────────────────────────────────

exports.getHistory = async (req, res) => {
  try {
    const { patientId } = req.params;
    if (req.user.role === 'patient' && req.user.patientId !== patientId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (req.user.role !== 'admin' && req.user.role !== 'doctor' && req.user.role !== 'patient') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);

    const [items, total] = await Promise.all([
      SymptomCheck.find({ patientId })
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      SymptomCheck.countDocuments({ patientId }),
    ]);

    res.status(200).json({ items, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getCheck = async (req, res) => {
  try {
    const check = await SymptomCheck.findById(req.params.id);
    if (!check) return res.status(404).json({ message: 'Not found' });
    if (req.user.role === 'patient' && check.patientId && check.patientId !== req.user.patientId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    res.status(200).json(check);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteCheck = async (req, res) => {
  try {
    const check = await SymptomCheck.findById(req.params.id);
    if (!check) return res.status(404).json({ message: 'Not found' });

    const isOwner = check.patientId && String(check.patientId) === String(req.user.patientId);
    if (req.user.role !== 'admin' && !isOwner) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await SymptomCheck.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Symptom check deleted', id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// #15 Bulk delete — patient may delete several of their own checks at once.
exports.bulkDeleteChecks = async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids must be a non-empty array of check ids' });
    }
    if (ids.length > 100) {
      return res.status(400).json({ message: 'Maximum 100 ids per request' });
    }

    // Patients can only delete their own; admins can delete any.
    const filter = req.user.role === 'admin'
      ? { _id: { $in: ids } }
      : { _id: { $in: ids }, patientId: req.user.patientId };

    const result = await SymptomCheck.deleteMany(filter);
    res.status(200).json({ message: 'Bulk delete complete', deleted: result.deletedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// A4: Submit feedback on a past symptom check.
exports.submitFeedback = async (req, res) => {
  try {
    const { type, comment } = req.body || {};
    if (!['false-positive', 'false-negative', 'correct'].includes(type)) {
      return res.status(400).json({ message: 'type must be one of: false-positive, false-negative, correct' });
    }

    const check = await SymptomCheck.findById(req.params.id);
    if (!check) return res.status(404).json({ message: 'Symptom check not found' });

    const isOwner = check.patientId && String(check.patientId) === String(req.user.patientId);
    if (req.user.role !== 'admin' && req.user.role !== 'doctor' && !isOwner) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const feedback = await SymptomCheckFeedback.findOneAndUpdate(
      { checkId: check._id, submittedBy: req.user.id },
      {
        $set: {
          checkId: check._id,
          patientId: check.patientId,
          type,
          comment: comment || '',
          submittedBy: req.user.id,
          role: req.user.role || 'patient',
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ message: 'Feedback recorded', feedback });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// #8 AI narrative summary — paragraph summary of the patient's chronic
// health picture. 24h cache via Mongo TTL on NarrativeSummary.
exports.getNarrative = async (req, res) => {
  try {
    const patientId = req.user?.patientId || req.body.patientId;
    if (!patientId) return res.status(400).json({ message: 'patientId is required' });
    if (req.user.role === 'patient' && req.user.patientId !== patientId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const language = (req.body && req.body.language) || (req.query && req.query.language) || 'en';
    const force = (req.query && req.query.refresh === 'true');

    if (!force) {
      const cached = await NarrativeSummary.findOne({ patientId });
      if (cached) {
        return res.status(200).json({
          patientId,
          summary: cached.summary,
          generatedAt: cached.generatedAt,
          cached: true,
          sourceModel: cached.sourceModel,
        });
      }
    }

    const authHeader = req.headers.authorization;
    const [patientCtx, prescriptions, deepHistory] = await Promise.all([
      fetchPatientContext(patientId, authHeader),
      fetchActivePrescriptions(patientId, authHeader),
      fetchDeepHistory(patientId, authHeader),
    ]);

    const contextBlock = buildContextBlock(patientCtx, prescriptions, deepHistory);
    const { text: promptText, version: promptVersion } = await renderPrompt('narrative', {
      contextBlock: contextBlock || '(no clinical context on file)',
      language,
    });

    let summary;
    let sourceModel = 'local-fallback';
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: MODEL_FLASH });
        const result = await model.generateContent(promptText);
        summary = (result.response.text() || '').trim();
        sourceModel = MODEL_FLASH;
      } catch (err) {
        console.warn('[ai/narrative] LLM failed:', err.message);
      }
    }
    if (!summary) {
      summary = 'A personalised summary could not be generated right now. Please try again later, or speak to your doctor for a comprehensive review of your records.';
    }

    const saved = await NarrativeSummary.findOneAndUpdate(
      { patientId },
      { $set: { patientId, summary, sourceModel, promptVersion, language, generatedAt: new Date() } },
      { upsert: true, new: true }
    );

    res.status(200).json({
      patientId,
      summary: saved.summary,
      generatedAt: saved.generatedAt,
      cached: false,
      sourceModel: saved.sourceModel,
      language: saved.language,
      disclaimer: 'AI-generated summary based on your records. Not a clinical diagnosis.',
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// #14 PDF export — minimal report rendered server-side. Uses pdfkit so we
// don't take on a Chromium dependency.
exports.exportCheckPdf = async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const check = await SymptomCheck.findById(req.params.id);
    if (!check) return res.status(404).json({ message: 'Not found' });

    const isOwner = check.patientId && String(check.patientId) === String(req.user.patientId);
    if (req.user.role !== 'admin' && req.user.role !== 'doctor' && !isOwner) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=medsync-symptom-check-${check._id}.pdf`);

    const doc = new PDFDocument({ margin: 48 });
    doc.pipe(res);

    doc.fontSize(20).fillColor('#0ea5e9').text('MedSync Symptom Check Report', { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#64748b').text(`Check ID: ${check._id}`);
    doc.text(`Generated: ${new Date().toISOString()}`);
    doc.text(`Recorded: ${check.timestamp ? new Date(check.timestamp).toLocaleString() : '?'}`);
    doc.moveDown();

    doc.fillColor('#0f172a').fontSize(14).text('Symptoms');
    doc.fontSize(11).fillColor('#334155').text(check.symptoms || '—', { width: 500 });
    doc.moveDown();

    doc.fillColor('#0f172a').fontSize(14).text('Triage');
    doc.fontSize(11).fillColor('#334155')
      .text(`Overall urgency: ${check.overallUrgency}   Confidence: ${Math.round((check.overallConfidence || 0) * 100)}%`);
    if (check.confidenceFlag === 'LOW') doc.text('⚠ Low confidence — verify with a clinician.');
    if (check.urgencyOverrideReason) doc.text(`Override: ${check.urgencyOverrideReason}`);
    if (check.aiSummary) {
      doc.moveDown(0.5).fillColor('#0f172a').fontSize(12).text('AI summary:');
      doc.fontSize(11).fillColor('#334155').text(check.aiSummary, { width: 500 });
    }
    doc.moveDown();

    if ((check.results || []).length > 0) {
      doc.fillColor('#0f172a').fontSize(14).text('Recommended specialties');
      for (const r of check.results) {
        doc.moveDown(0.4).fontSize(12).fillColor('#0f172a').text(`• ${r.specialty} — urgency ${r.urgency} (${Math.round((r.confidence || 0) * 100)}%)`);
        doc.fontSize(10).fillColor('#334155').text(r.suggestions || '', { width: 500 });
        if (r.icd10Codes && r.icd10Codes.length > 0) {
          doc.fontSize(9).fillColor('#64748b').text(
            'ICD-10: ' + r.icd10Codes.map((c) => `${c.code} ${c.description}`).join(', '),
            { width: 500 }
          );
        }
      }
      doc.moveDown();
    }

    if ((check.redFlags || []).length > 0) {
      doc.fillColor('#dc2626').fontSize(14).text('Red flags detected');
      for (const r of check.redFlags) {
        doc.fontSize(11).fillColor('#7f1d1d').text(`• ${r.label}: ${r.advice}`, { width: 500 });
      }
      doc.moveDown();
    }

    if ((check.possibleDrugSideEffects || []).length > 0) {
      doc.fillColor('#0f172a').fontSize(14).text('Possible medication side effects');
      for (const w of check.possibleDrugSideEffects) {
        doc.fontSize(10).fillColor('#334155').text(`• ${w.drug}: ${w.note} (${w.advice})`, { width: 500 });
      }
      doc.moveDown();
    }

    doc.moveDown();
    doc.fontSize(8).fillColor('#94a3b8').text(
      'This is a preliminary AI-generated summary. Not a diagnosis. Always consult a qualified healthcare professional. ' +
      `Generated by ${check.sourceModel || 'unknown'}.`,
      { width: 500 }
    );

    doc.end();
  } catch (error) {
    console.error('[ai] exportCheckPdf error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getAdminAnalytics = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [totals, urgencyBreakdown, topSpecialties, dailyTrend, feedbackBreakdown, lowConfidenceCount, redFlagCount, modelUsage] = await Promise.all([
      SymptomCheck.countDocuments({}),
      SymptomCheck.aggregate([{ $group: { _id: '$overallUrgency', count: { $sum: 1 } } }]),
      SymptomCheck.aggregate([
        { $unwind: '$results' },
        { $group: { _id: '$results.specialty', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      SymptomCheck.aggregate([
        { $match: { timestamp: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            count: { $sum: 1 },
            emergencies: { $sum: { $cond: [{ $eq: ['$overallUrgency', 'emergency'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      SymptomCheckFeedback.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
      SymptomCheck.countDocuments({ confidenceFlag: 'LOW', timestamp: { $gte: since } }),
      SymptomCheck.countDocuments({ 'redFlags.0': { $exists: true }, timestamp: { $gte: since } }),
      SymptomCheck.aggregate([
        { $match: { timestamp: { $gte: since } } },
        { $group: { _id: '$sourceModel', count: { $sum: 1 } } },
      ]),
    ]);

    res.status(200).json({
      totalChecks: totals,
      urgencyBreakdown,
      topSpecialties,
      dailyTrend,
      feedbackBreakdown,
      lowConfidenceLast30Days: lowConfidenceCount,
      redFlagLast30Days: redFlagCount,
      modelUsageLast30Days: modelUsage,
      generatedAt: new Date(),
      windowDays: 30,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─── #16 Prompt management (admin) ────────────────────────────────────────────

exports.listPrompts = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
    const items = await PromptVersion.find().sort({ name: 1, version: -1 });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createPrompt = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
    const { name, template, description, activate } = req.body || {};
    if (!['triage', 'image', 'narrative', 'conversation'].includes(name)) {
      return res.status(400).json({ message: 'Invalid prompt name' });
    }
    if (!template || !template.trim()) return res.status(400).json({ message: 'template is required' });

    const latest = await PromptVersion.findOne({ name }).sort({ version: -1 });
    const nextVersion = (latest?.version || 0) + 1;
    const created = await PromptVersion.create({
      name, template, description, version: nextVersion, active: false,
      createdBy: req.user.email || req.user.id,
    });

    if (activate) {
      // Deactivate any current active row for this name first.
      await PromptVersion.updateMany({ name, active: true }, { $set: { active: false } });
      created.active = true;
      await created.save();
    }

    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.activatePrompt = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
    const target = await PromptVersion.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'Prompt version not found' });
    await PromptVersion.updateMany({ name: target.name, active: true }, { $set: { active: false } });
    target.active = true;
    await target.save();
    res.status(200).json(target);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
