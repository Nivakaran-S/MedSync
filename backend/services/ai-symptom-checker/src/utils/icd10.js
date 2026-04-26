// #13 ICD-10 mapping — small lookup table that maps each MedSync specialty
// (and a few common symptom keywords) to the most likely ICD-10 codes.
// This is intentionally a starter set, not a clinical coding dictionary.
// For full coverage swap in WHO's ICD-10 API behind the same interface.

const SPECIALTY_TO_ICD10 = {
  Cardiologist: [
    { code: 'I20', description: 'Angina pectoris' },
    { code: 'I21', description: 'Acute myocardial infarction' },
    { code: 'I10', description: 'Essential (primary) hypertension' },
    { code: 'I50', description: 'Heart failure' },
  ],
  'General Physician': [
    { code: 'R50', description: 'Fever, unspecified' },
    { code: 'R51', description: 'Headache' },
    { code: 'R53', description: 'Malaise and fatigue' },
    { code: 'J06', description: 'Acute upper respiratory infections' },
  ],
  Dermatologist: [
    { code: 'L23', description: 'Allergic contact dermatitis' },
    { code: 'L30', description: 'Other and unspecified dermatitis' },
    { code: 'L70', description: 'Acne' },
    { code: 'L20', description: 'Atopic dermatitis (eczema)' },
  ],
  Neurologist: [
    { code: 'G43', description: 'Migraine' },
    { code: 'G45', description: 'Transient cerebral ischemic attacks' },
    { code: 'R55', description: 'Syncope and collapse' },
    { code: 'R20', description: 'Disturbances of skin sensation' },
  ],
  Gastroenterologist: [
    { code: 'K21', description: 'Gastro-oesophageal reflux disease' },
    { code: 'R10', description: 'Abdominal and pelvic pain' },
    { code: 'A09', description: 'Infectious gastroenteritis' },
    { code: 'K59', description: 'Other functional intestinal disorders' },
  ],
  Orthopedic: [
    { code: 'M54', description: 'Dorsalgia (back pain)' },
    { code: 'M25', description: 'Other joint disorders' },
    { code: 'S93', description: 'Sprain of joints/ligaments at ankle/foot' },
  ],
  'ENT Specialist': [
    { code: 'H66', description: 'Suppurative and unspecified otitis media' },
    { code: 'J32', description: 'Chronic sinusitis' },
    { code: 'J03', description: 'Acute tonsillitis' },
  ],
  Ophthalmologist: [
    { code: 'H10', description: 'Conjunctivitis' },
    { code: 'H53', description: 'Visual disturbances' },
    { code: 'H57', description: 'Other disorders of eye and adnexa' },
  ],
  Psychiatrist: [
    { code: 'F32', description: 'Depressive episode' },
    { code: 'F41', description: 'Other anxiety disorders' },
    { code: 'F51', description: 'Sleep disorders, non-organic' },
  ],
  Urologist: [
    { code: 'N39', description: 'Other disorders of urinary system' },
    { code: 'N20', description: 'Calculus of kidney and ureter' },
    { code: 'R31', description: 'Unspecified haematuria' },
  ],
  Pulmonologist: [
    { code: 'J45', description: 'Asthma' },
    { code: 'J44', description: 'Chronic obstructive pulmonary disease' },
    { code: 'J18', description: 'Pneumonia, organism unspecified' },
  ],
  Endocrinologist: [
    { code: 'E10', description: 'Type 1 diabetes mellitus' },
    { code: 'E11', description: 'Type 2 diabetes mellitus' },
    { code: 'E03', description: 'Hypothyroidism, unspecified' },
    { code: 'E66', description: 'Obesity' },
  ],
  'Emergency Medicine': [
    { code: 'R57', description: 'Shock, not elsewhere classified' },
    { code: 'T78', description: 'Adverse effects, NEC (e.g. anaphylaxis)' },
    { code: 'I46', description: 'Cardiac arrest' },
  ],
};

/**
 * Suggest up to N ICD-10 codes for a triage result.
 * Looks at the specialty first, then refines with keyword hints from
 * matchedKeywords / suggestions text.
 */
function suggestICD10(specialty, hints = '', max = 3) {
  const base = SPECIALTY_TO_ICD10[specialty] || [];
  if (!hints) return base.slice(0, max);

  const text = String(hints).toLowerCase();
  // Re-rank base codes whose description shares words with the hints text.
  const scored = base
    .map((c) => {
      const words = c.description.toLowerCase().split(/[\s,-/()]+/).filter((w) => w.length > 3);
      const score = words.filter((w) => text.includes(w)).length;
      return { ...c, _score: score };
    })
    .sort((a, b) => b._score - a._score);
  return scored.slice(0, max).map(({ _score, ...rest }) => rest);
}

module.exports = { suggestICD10, SPECIALTY_TO_ICD10 };
