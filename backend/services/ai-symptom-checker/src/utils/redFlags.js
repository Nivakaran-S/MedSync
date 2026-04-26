// #1 Red-flag clusters — life-threatening symptom combinations that MUST
// escalate to emergency regardless of what the LLM says. This is a defence
// against false-negative LLM responses on the most dangerous presentations.
//
// Each cluster matches when ALL `requireAll` patterns are present AND
// `severityHint` (if defined) is met. Curated from common ED red-flag lists
// (NHS, AHA, NICE). Intentionally conservative — false alarm beats missed call.

const CLUSTERS = [
  {
    code: 'STROKE',
    label: 'Possible stroke (FAST)',
    requireAny: [
      [/face droop|facial weakness|drooping/i, /arm weakness|leg weakness|one.?sided/i],
      [/sudden|abrupt/i, /confusion|slurred speech|trouble speaking/i],
      [/sudden|abrupt|worst/i, /headache/i],
      [/vision loss/i, /sudden/i],
    ],
    advice: 'Possible stroke. Note time of onset and call emergency services immediately.',
  },
  {
    code: 'ACS',
    label: 'Possible acute coronary syndrome',
    requireAny: [
      [/chest pain|chest pressure|chest tightness|chest discomfort/i, /sweat|nausea|short.?ness of breath|jaw|left arm|radiating/i],
      [/crushing/i, /chest/i],
    ],
    advice: 'Possible heart attack. Sit/lie down, chew aspirin if not allergic, call emergency services.',
  },
  {
    code: 'ANAPHYLAXIS',
    label: 'Possible anaphylaxis',
    requireAny: [
      [/swelling/i, /tongue|throat|face|lips/i],
      [/difficulty breathing|throat closing|wheez/i, /rash|hives|allerg/i],
    ],
    advice: 'Possible anaphylaxis. Use epinephrine auto-injector if available; call emergency services.',
  },
  {
    code: 'SEPSIS',
    label: 'Possible sepsis',
    requireAll: [
      /fever|high temperature|hot/i,
      /confusion|disorient|drowsy|lethargic|cold|clammy|skin mottled/i,
    ],
    advice: 'Possible sepsis. Seek emergency care immediately.',
  },
  {
    code: 'PE',
    label: 'Possible pulmonary embolism',
    requireAll: [
      /short.?ness of breath|difficulty breathing/i,
      /sharp chest pain|pleuritic|cough.*blood|haemoptysis/i,
    ],
    advice: 'Possible pulmonary embolism. Seek emergency care immediately.',
  },
  {
    code: 'MENINGITIS',
    label: 'Possible meningitis',
    requireAll: [
      /(headache|head pain).*(severe|worst)|severe headache/i,
      /stiff neck|photophob|light sensitiv|rash/i,
    ],
    advice: 'Possible meningitis. Seek emergency care immediately.',
  },
  {
    code: 'ECTOPIC',
    label: 'Possible ectopic pregnancy',
    requireAll: [
      /(pregnan|missed period)/i,
      /(severe|sharp).*(abdominal|pelvic|belly) pain|abdominal pain.*(severe|sharp)/i,
    ],
    advice: 'Possible ectopic pregnancy. Seek emergency care immediately.',
  },
  {
    code: 'GI_BLEED',
    label: 'Possible major GI bleed',
    requireAny: [
      [/vomit/i, /blood|coffee.?ground/i],
      [/black stool|tarry stool|melena|melaena/i],
      [/blood/i, /stool|rectal/i],
    ],
    advice: 'Possible major GI bleed. Seek emergency care immediately.',
  },
  {
    code: 'DKA',
    label: 'Possible diabetic ketoacidosis',
    requireAll: [
      /(diabet|high blood sugar|hyperglyc)/i,
      /(vomit|abdominal pain|fruity breath|deep breathing|kussmaul|confusion|drows)/i,
    ],
    advice: 'Possible diabetic ketoacidosis. Seek emergency care immediately.',
  },
  {
    code: 'SUICIDE',
    label: 'Active suicidal ideation',
    requireAny: [
      [/suicid|kill myself|end my life|harm myself/i],
      [/plan/i, /suicid|harm/i],
    ],
    advice: 'You are not alone. Please contact a crisis line (1926 in Sri Lanka, 988 in US, 116 123 in UK) or go to the nearest emergency department now.',
  },
];

const matchesAll = (text, regexes) => regexes.every((r) => r.test(text));
const matchesAny = (text, anyOf) => anyOf.some((set) => matchesAll(text, set));

/**
 * Detect red-flag clusters in the patient's free-text symptoms (+ optional
 * additional context). Returns `{ clusters: [{code,label,advice}], hit }`.
 * `hit` is true if any cluster fired.
 */
function detectRedFlags(text) {
  const haystack = String(text || '');
  const hits = [];
  for (const c of CLUSTERS) {
    let matched = false;
    if (c.requireAll && matchesAll(haystack, c.requireAll)) matched = true;
    if (!matched && c.requireAny && matchesAny(haystack, c.requireAny)) matched = true;
    if (matched) hits.push({ code: c.code, label: c.label, advice: c.advice });
  }
  return { clusters: hits, hit: hits.length > 0 };
}

module.exports = { detectRedFlags, CLUSTERS };
