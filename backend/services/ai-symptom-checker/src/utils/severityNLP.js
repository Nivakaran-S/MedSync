// #3 NLP severity scoring — derive an "implied severity" from the patient's
// own language and cross-check it against their self-reported severity.
// Patients often under-report; phrases like "unbearable" or "can't breathe"
// signal escalation regardless of the dropdown.

const STRONG = [
  /unbearable|excruciating|worst (pain|ever|of my life)/i,
  /can.?t (breathe|move|stand|sleep|eat)/i,
  /collaps|unconscious|fainting/i,
  /constant|nonstop|all the time/i,
  /screaming|crying from pain/i,
  /getting worse|worsening|deteriorat/i,
  /(severe|extreme) (pain|bleeding|swelling)/i,
];

const MILD = [
  /(slight|mild|minor|tiny|small) (pain|ache|discomfort)/i,
  /a bit|a little|kind of|sort of|maybe/i,
  /comes and goes|on and off|intermittent/i,
];

const SEVERITY_RANK = { mild: 1, moderate: 2, severe: 3, unspecified: 0 };

/**
 * Returns:
 *   {
 *     impliedSeverity: 'mild' | 'moderate' | 'severe' | 'unspecified',
 *     impliedScore: 0..1,                 // confidence-style number
 *     mismatch: bool,                     // true if implied ≥2 levels above self-reported
 *     mismatchNote: string|null,
 *   }
 */
function deriveSeverity(text, selfReported) {
  const haystack = String(text || '');
  let impliedScore = 0;
  let strongHits = 0;
  let mildHits = 0;
  for (const re of STRONG) if (re.test(haystack)) { strongHits++; impliedScore += 0.3; }
  for (const re of MILD)   if (re.test(haystack)) { mildHits++;   impliedScore -= 0.15; }
  impliedScore = Math.max(0, Math.min(1, impliedScore));

  let impliedSeverity = 'unspecified';
  if (strongHits >= 2) impliedSeverity = 'severe';
  else if (strongHits === 1) impliedSeverity = 'moderate';
  else if (mildHits > 0) impliedSeverity = 'mild';

  const selfRank = SEVERITY_RANK[selfReported] || 0;
  const implRank = SEVERITY_RANK[impliedSeverity] || 0;
  const mismatch = implRank > 0 && selfRank > 0 && implRank - selfRank >= 2;
  const mismatchNote = mismatch
    ? `Patient self-reported "${selfReported}" but their wording suggests "${impliedSeverity}" — review carefully.`
    : null;

  return { impliedSeverity, impliedScore, mismatch, mismatchNote };
}

module.exports = { deriveSeverity };
