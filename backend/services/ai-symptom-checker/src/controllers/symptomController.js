const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const SymptomCheck = require('../models/SymptomCheck');
const Conversation = require('../models/Conversation');
const { sendEvent } = require('../utils/kafka');
const {
  fetchPatientContext,
  fetchActivePrescriptions,
  fetchVerifiedDoctorsBySpecialty,
} = require('../utils/patientContext');

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const MODEL_TEXT = 'gemini-1.5-pro';
const MODEL_VISION = 'gemini-1.5-pro';

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

const buildContextBlock = (patientCtx, prescriptions) => {
  if (!patientCtx) return '';
  const lines = ['', 'PATIENT CLINICAL CONTEXT:'];
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
  return lines.join('\n');
};

const triagePromptText = (symptoms, severity, durationDays, bodyLocation, additionalContext, contextBlock) => `
You are MedSync's clinical triage AI. Triage the following report and respond with STRICT JSON only — no markdown, no commentary.

PATIENT REPORT:
- Symptoms: "${symptoms}"
- Severity (self-reported): ${severity}
- Duration (days): ${durationDays ?? 'unspecified'}
- Body location: ${bodyLocation || 'unspecified'}
- Additional context: ${additionalContext || 'none'}
${contextBlock}

REQUIRED JSON shape:
{
  "aiSummary": "1–2 sentence empathetic summary of likely cause and immediate guidance.",
  "overallUrgency": "low" | "medium" | "high" | "emergency",
  "overallConfidence": 0.0–1.0,
  "results": [
    {
      "specialty": "Cardiologist | General Physician | …",
      "urgency": "low" | "medium" | "high" | "emergency",
      "suggestions": "1–2 sentence specialty-specific guidance.",
      "matchedKeywords": ["array of extracted symptom phrases"],
      "confidence": 0.0–1.0
    }
  ],
  "drugInteractionWarnings": ["string"],
  "allergyWarnings": ["string"]
}

Rules:
- If signs are life-threatening (chest pain, stroke signs, severe bleeding, anaphylaxis), set overallUrgency=emergency.
- If patient context lists allergies that overlap any recommended medication class, populate allergyWarnings.
- If patient context lists active medications that interact with proposed treatment classes, populate drugInteractionWarnings.
- If symptom set is non-specific, recommend "General Physician".
- Output JSON only.
`;

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

// ─── Endpoints ────────────────────────────────────────────────────────────────

exports.analyzeSymptoms = async (req, res) => {
  try {
    const { symptoms, severity = 'unspecified', durationDays, bodyLocation, additionalContext } = req.body;
    if (!symptoms || !symptoms.trim()) {
      return res.status(400).json({ message: 'Symptoms are required' });
    }

    const patientId = req.user?.patientId || req.body.patientId || null;
    const authHeader = req.headers.authorization;

    // Pull patient context + active prescriptions in parallel
    const [patientCtx, activePrescriptions] = await Promise.all([
      patientId ? fetchPatientContext(patientId, authHeader) : Promise.resolve(null),
      patientId ? fetchActivePrescriptions(patientId, authHeader) : Promise.resolve([]),
    ]);

    const input = symptoms.toLowerCase();
    let analysis;

    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: MODEL_TEXT });
        const contextBlock = buildContextBlock(patientCtx, activePrescriptions);
        const prompt = triagePromptText(symptoms, severity, durationDays, bodyLocation, additionalContext, contextBlock);
        const result = await model.generateContent(prompt);
        analysis = JSON.parse(stripJSON(result.response.text()));
      } catch (aiErr) {
        console.warn('[ai] Gemini call failed, using fallback:', aiErr.message);
        analysis = fallbackAnalyse(input);
      }
    } else {
      analysis = fallbackAnalyse(input);
    }

    // Recommend doctors for the top specialty
    const topSpecialty = analysis.results?.[0]?.specialty;
    const recommendedDoctors = topSpecialty
      ? await fetchVerifiedDoctorsBySpecialty(topSpecialty, authHeader)
      : [];

    // Persist
    const check = new SymptomCheck({
      patientId,
      symptoms: input,
      severity,
      durationDays,
      bodyLocation,
      additionalContext,
      aiSummary: analysis.aiSummary,
      results: (analysis.results || []).map((r) => ({
        specialty: r.specialty,
        suggestions: r.suggestions,
        urgency: r.urgency,
        matchedKeywords: r.matchedKeywords || [],
        confidence: typeof r.confidence === 'number' ? r.confidence : 0.5,
      })),
      overallUrgency: analysis.overallUrgency || 'low',
      overallConfidence: typeof analysis.overallConfidence === 'number' ? analysis.overallConfidence : 0.5,
      drugInteractionWarnings: analysis.drugInteractionWarnings || [],
      allergyWarnings: analysis.allergyWarnings || [],
      recommendedDoctors,
      sourceModel: genAI ? MODEL_TEXT : 'local-fallback',
    });
    await check.save();

    // Always emit the routine event
    await sendEvent('symptom-events', {
      type: 'SYMPTOM_CHECK_PERFORMED',
      checkId: check._id,
      symptoms: input,
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
        checkId: check._id,
        patientId,
        patientName: patientCtx?.patient?.name,
        emergencyContact: patientCtx?.profile?.emergencyContact,
        symptoms: input,
        summary: check.aiSummary,
        timestamp: new Date(),
      });
    }

    res.status(200).json({
      results: check.results,
      overallUrgency: check.overallUrgency,
      overallConfidence: check.overallConfidence,
      aiSummary: check.aiSummary,
      drugInteractionWarnings: check.drugInteractionWarnings,
      allergyWarnings: check.allergyWarnings,
      recommendedDoctors: check.recommendedDoctors,
      contextUsed: !!patientCtx,
      checkId: check._id,
      disclaimer: 'This is a preliminary AI suggestion, not a diagnosis. Consult a qualified healthcare professional.',
    });
  } catch (error) {
    console.error('[ai] analyze error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── Image analysis (Gemini Vision) ───────────────────────────────────────────

exports.analyzeImage = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'An image file is required' });
    if (!genAI) return res.status(503).json({ message: 'AI vision service is not configured' });

    const { description = '' } = req.body;
    const patientId = req.user?.patientId || req.body.patientId || null;

    const buffer = fs.readFileSync(req.file.path);
    const inlineData = { data: buffer.toString('base64'), mimeType: req.file.mimetype };

    const model = genAI.getGenerativeModel({ model: MODEL_VISION });
    const prompt = `
You are MedSync's clinical triage AI inspecting a patient-supplied image of a possible skin/wound/visible-lesion concern.
Patient note: "${description}"

Respond as STRICT JSON ONLY:
{
  "aiSummary": "1-2 sentences",
  "overallUrgency": "low" | "medium" | "high" | "emergency",
  "overallConfidence": 0.0-1.0,
  "visibleFindings": ["array of observed findings"],
  "results": [{ "specialty": "...", "urgency": "...", "suggestions": "...", "confidence": 0.0-1.0 }]
}
If you cannot tell from the image, respond with overallUrgency="low" and recommend "General Physician".
`;

    const ai = await model.generateContent([{ inlineData }, prompt]);
    const parsed = JSON.parse(stripJSON(ai.response.text()));

    const check = new SymptomCheck({
      patientId,
      symptoms: description || '[image-only consultation]',
      additionalContext: 'image upload',
      aiSummary: parsed.aiSummary,
      results: (parsed.results || []).map((r) => ({
        specialty: r.specialty,
        suggestions: r.suggestions,
        urgency: r.urgency,
        confidence: r.confidence,
        matchedKeywords: parsed.visibleFindings || [],
      })),
      overallUrgency: parsed.overallUrgency || 'low',
      overallConfidence: parsed.overallConfidence || 0.5,
      imageAnalyzed: true,
      sourceModel: MODEL_VISION,
    });
    await check.save();

    // Cleanup uploaded image
    fs.unlink(req.file.path, () => {});

    await sendEvent('symptom-events', {
      type: 'SYMPTOM_IMAGE_ANALYZED',
      checkId: check._id,
      urgency: check.overallUrgency,
      patientId,
      timestamp: new Date(),
    });

    res.status(200).json({
      results: check.results,
      overallUrgency: check.overallUrgency,
      overallConfidence: check.overallConfidence,
      aiSummary: check.aiSummary,
      visibleFindings: parsed.visibleFindings || [],
      checkId: check._id,
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
    const model = genAI.getGenerativeModel({ model: MODEL_TEXT });
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

exports.getAdminAnalytics = async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });

    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [totals, urgencyBreakdown, topSpecialties, dailyTrend] = await Promise.all([
      SymptomCheck.countDocuments({}),
      SymptomCheck.aggregate([
        { $group: { _id: '$overallUrgency', count: { $sum: 1 } } },
      ]),
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
            emergencies: {
              $sum: { $cond: [{ $eq: ['$overallUrgency', 'emergency'] }, 1, 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.status(200).json({
      totalChecks: totals,
      urgencyBreakdown,
      topSpecialties,
      dailyTrend,
      generatedAt: new Date(),
      windowDays: 30,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
