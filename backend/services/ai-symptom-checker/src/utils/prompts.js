// #16 Prompt loader. Resolves the active prompt template from the
// PromptVersion collection, falling back to in-code defaults if nothing
// is stored. Templates are simple string-substitution: `{{var}}` placeholders.

const PromptVersion = require('../models/PromptVersion');

// ── Default templates ────────────────────────────────────────────────────────
// These mirror what was previously hard-coded in the controller, but now
// expose every variable as a placeholder so admins can re-word the prompt
// without code changes.

const DEFAULTS = {
  triage: {
    version: '1.0-default',
    template: `
You are MedSync's clinical triage AI. Triage the following report and respond with STRICT JSON only — no markdown, no commentary.
Respond in the patient's language: {{language}}.

PATIENT REPORT:
- Symptoms: "{{symptoms}}"
- Severity (self-reported): {{severity}}
- Duration (days): {{durationDays}}
- Body location: {{bodyLocation}}
- Additional context: {{additionalContext}}
{{contextBlock}}

{{redFlagBlock}}
{{progressionBlock}}

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
      "confidence": 0.0–1.0,
      "demographicNote": "Optional 1-sentence note on age/sex-specific risk for this specialty"
    }
  ],
  "drugInteractionWarnings": ["string"],
  "allergyWarnings": ["string"],
  "progressionAnalysis": {
    "trend": "improving" | "stable" | "worsening" | "unknown",
    "explanation": "If progression context provided, comment on the trend"
  }
}

Rules:
- If signs are life-threatening (chest pain, stroke signs, severe bleeding, anaphylaxis), set overallUrgency=emergency.
- Adjust differential diagnosis for the patient's age and sex when populating demographicNote (e.g. atypical ACS in young women, occult PE in pregnancy).
- If patient context lists allergies that overlap any recommended medication class, populate allergyWarnings.
- If patient context lists active medications that interact with proposed treatment classes, populate drugInteractionWarnings.
- If progression context is provided, fill progressionAnalysis. Otherwise set trend="unknown".
- If symptom set is non-specific, recommend "General Physician".
- Output JSON only.
`.trim(),
  },

  image: {
    version: '1.0-default',
    template: `
You are MedSync's clinical triage AI inspecting a patient-supplied image.
Image kind (declared by user): {{imageKind}}
Patient note: "{{description}}"
Respond in the patient's language: {{language}}.

Important constraints by kind:
- skin / rash / wound: visible inspection only. Do NOT diagnose; suggest specialty.
- lab-report: extract obvious abnormal values; flag clearly. Do NOT interpret in isolation.
- xray / ecg: preliminary visual scan only. Always recommend specialist review (Radiologist / Cardiologist) regardless of findings. Set overallUrgency=medium minimum unless plainly emergency.

Respond as STRICT JSON ONLY:
{
  "aiSummary": "1-2 sentences",
  "overallUrgency": "low" | "medium" | "high" | "emergency",
  "overallConfidence": 0.0-1.0,
  "visibleFindings": ["array of observed findings"],
  "extractedValues": [{"label": "...", "value": "...", "isAbnormal": true|false}],
  "results": [{ "specialty": "...", "urgency": "...", "suggestions": "...", "confidence": 0.0-1.0 }]
}
If you cannot tell from the image, respond with overallUrgency="low" and recommend "General Physician".
`.trim(),
  },

  narrative: {
    version: '1.0-default',
    template: `
You are MedSync's clinical scribe. In 4-6 sentences, write a paragraph-form summary
of this patient's current health picture for THEM to read. Use plain language.

PATIENT CONTEXT:
{{contextBlock}}

Rules:
- Address the patient as "you".
- Mention chronic conditions, key allergies, current medications, and any
  notable recent vital trends.
- End with a concrete next step (e.g. "schedule a follow-up if X").
- Do NOT invent diagnoses or values — only use what is in the context.
- Respond in: {{language}}
`.trim(),
  },
};

const fillTemplate = (template, vars = {}) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : ''
  );

/**
 * Resolve the active prompt for a given name. Returns { template, version }.
 * Falls back to the in-code default if no active row exists.
 */
async function getActivePrompt(name) {
  if (!DEFAULTS[name]) throw new Error(`Unknown prompt name: ${name}`);
  try {
    const active = await PromptVersion.findOne({ name, active: true });
    if (active) return { template: active.template, version: `${name}-v${active.version}` };
  } catch (err) {
    console.warn('[ai/prompts] DB lookup failed, using default:', err.message);
  }
  return { template: DEFAULTS[name].template, version: DEFAULTS[name].version };
}

/**
 * Render an active prompt with variables already substituted.
 * Returns { text, version }.
 */
async function renderPrompt(name, vars = {}) {
  const { template, version } = await getActivePrompt(name);
  return { text: fillTemplate(template, vars), version };
}

module.exports = { getActivePrompt, renderPrompt, DEFAULTS };
