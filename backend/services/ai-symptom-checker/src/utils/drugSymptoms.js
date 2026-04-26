// #5 Drug-symptom interaction library — surface "your symptom may be a side
// effect of your current medication" advice. Curated short list of common,
// clinically important pairings. Intentionally conservative: only well-known
// pairings, never tells patient to STOP a drug — only "discuss with your
// doctor before stopping or changing dose".

const PAIRINGS = [
  { drug: /lisinopril|enalapril|ramipril|captopril|ace inhibitor/i, symptoms: [/dry cough|persistent cough/i], note: 'A persistent dry cough is a known side effect of ACE inhibitors.' },
  { drug: /atorvastatin|simvastatin|rosuvastatin|statin/i, symptoms: [/muscle (pain|ache|cramp|weakness)|myalgia/i], note: 'Muscle pain is a known side effect of statins.' },
  { drug: /metformin/i, symptoms: [/diarrhea|nausea|stomach (pain|upset)|gi upset|vomiting/i], note: 'GI upset is a common side effect of metformin, especially when starting.' },
  { drug: /amlodipine|nifedipine|felodipine/i, symptoms: [/ankle swelling|leg swelling|peripheral edema/i], note: 'Ankle/leg swelling is a known side effect of dihydropyridine calcium-channel blockers.' },
  { drug: /amitriptyline|nortriptyline|imipramine|tricyclic/i, symptoms: [/dry mouth|constipation|urinary retention|drowsi/i], note: 'These are classic anticholinergic side effects of tricyclic antidepressants.' },
  { drug: /sertraline|fluoxetine|paroxetine|citalopram|escitalopram|ssri/i, symptoms: [/insomnia|nausea|sexual dysfunction|low libido|sweating/i], note: 'These are common SSRI side effects, especially in the first few weeks.' },
  { drug: /furosemide|hydrochlorothiazide|diuretic/i, symptoms: [/dehydrat|dizz|frequent urination|leg cramp|weakness/i], note: 'Diuretics can cause dehydration and electrolyte imbalance.' },
  { drug: /warfarin|apixaban|rivaroxaban|dabigatran/i, symptoms: [/easy bruising|bleeding|nosebleed|blood in (urine|stool)/i], note: 'Increased bleeding is expected with anticoagulants — but unusual or heavy bleeding warrants urgent review.' },
  { drug: /opioid|tramadol|codeine|morphine|oxycodone/i, symptoms: [/constipation|drowsi|nausea|itching/i], note: 'Constipation, drowsiness and itching are common opioid side effects.' },
  { drug: /metronidazole|tinidazole/i, symptoms: [/metallic taste|nausea/i], note: 'Metallic taste is a known side effect of metronidazole.' },
  { drug: /steroid|prednisolone|prednisone|dexamethasone/i, symptoms: [/insomnia|mood (swing|change)|increased appetite|weight gain|moon face/i], note: 'Mood changes, insomnia and increased appetite are common with steroids.' },
  { drug: /antihistamine|cetirizine|loratadine|diphenhydramine/i, symptoms: [/drowsi|dry mouth|sedat/i], note: 'Drowsiness and dry mouth are common antihistamine side effects.' },
  { drug: /levothyroxine|thyroxine/i, symptoms: [/palpitations|tremor|anxiety|weight loss|diarrhea|insomnia/i], note: 'These can indicate the levothyroxine dose is too high.' },
  { drug: /beta.?blocker|propranolol|metoprolol|atenolol|bisoprolol/i, symptoms: [/fatigue|cold (hand|feet|extrem)|low mood|wheez/i], note: 'Fatigue and cold extremities are common with beta-blockers; wheezing may indicate they are unsuitable for asthmatics.' },
];

/**
 * Cross-reference patient's current medications with their reported symptoms.
 * Returns array of `{ drug, symptom, note }` warnings.
 *
 * `prescriptions` is the array from fetchActivePrescriptions (each item has
 * a `medication` or `name` field).
 */
function detectSideEffects(symptoms, prescriptions) {
  if (!symptoms || !Array.isArray(prescriptions) || prescriptions.length === 0) return [];
  const text = String(symptoms);
  const out = [];
  for (const p of prescriptions) {
    const medName = p?.medication || p?.name || (typeof p === 'string' ? p : '');
    if (!medName) continue;
    for (const pairing of PAIRINGS) {
      if (!pairing.drug.test(medName)) continue;
      for (const symRe of pairing.symptoms) {
        if (symRe.test(text)) {
          out.push({
            drug: medName,
            symptomMatch: text.match(symRe)?.[0] || symRe.source,
            note: pairing.note,
            advice: 'Discuss with your doctor before stopping or changing the dose.',
          });
          break; // one warning per drug is enough
        }
      }
    }
  }
  return out;
}

module.exports = { detectSideEffects };
