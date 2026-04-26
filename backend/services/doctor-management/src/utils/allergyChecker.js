// Curated cross-reactivity table for the most common drug allergies.
// Source: AAFP/UpToDate-style drug-class cross-reactivity summaries.
// This is intentionally a small, hand-curated list — NOT a comprehensive
// pharmacology lookup. It catches the high-frequency dangerous mismatches.
// For production-grade checks, swap in a clinical decision support service
// (e.g. RxNorm + DrugBank) behind the same `checkAllergies()` interface.

const RULES = [
  {
    allergen: 'Penicillin',
    matches: /(penicillin|penicillins?)/i,
    conflictingDrugs: [
      'Amoxicillin', 'Ampicillin', 'Penicillin V', 'Penicillin G',
      'Augmentin', 'Amoxiclav', 'Piperacillin', 'Cloxacillin', 'Flucloxacillin',
    ],
  },
  {
    allergen: 'Sulfa / Sulfonamide',
    matches: /(sulfa|sulfonamide|sulpha)/i,
    conflictingDrugs: [
      'Sulfamethoxazole', 'Trimethoprim', 'Co-trimoxazole', 'Bactrim',
      'Sulfasalazine', 'Sulfadiazine', 'Sulfacetamide',
    ],
  },
  {
    allergen: 'Aspirin / NSAID',
    matches: /(aspirin|nsaid|ibuprofen|naproxen|salicylate)/i,
    conflictingDrugs: [
      'Aspirin', 'Ibuprofen', 'Naproxen', 'Diclofenac',
      'Ketorolac', 'Celecoxib', 'Indomethacin', 'Piroxicam', 'Mefenamic',
    ],
  },
  {
    allergen: 'Cephalosporin',
    matches: /(cephalosporin|cefa|cef)/i,
    conflictingDrugs: [
      'Cefalexin', 'Cefuroxime', 'Cefixime', 'Ceftriaxone',
      'Cefpodoxime', 'Cefepime', 'Cefazolin',
    ],
  },
  {
    allergen: 'Macrolide',
    matches: /(macrolide|erythromycin|azithromycin|clarithromycin)/i,
    conflictingDrugs: ['Erythromycin', 'Azithromycin', 'Clarithromycin', 'Roxithromycin'],
  },
  {
    allergen: 'Tetracycline',
    matches: /(tetracycline|doxycycline|minocycline)/i,
    conflictingDrugs: ['Tetracycline', 'Doxycycline', 'Minocycline', 'Tigecycline'],
  },
  {
    allergen: 'Fluoroquinolone',
    matches: /(quinolone|ciprofloxacin|levofloxacin|moxifloxacin)/i,
    conflictingDrugs: [
      'Ciprofloxacin', 'Levofloxacin', 'Moxifloxacin', 'Norfloxacin', 'Ofloxacin',
    ],
  },
  {
    allergen: 'Codeine / Opioid',
    matches: /(codeine|opioid|morphine|tramadol|oxycodone|hydrocodone)/i,
    conflictingDrugs: ['Codeine', 'Tramadol', 'Morphine', 'Oxycodone', 'Hydrocodone', 'Pethidine'],
  },
  {
    allergen: 'Iodine / Contrast',
    matches: /(iodine|iodinated|contrast)/i,
    conflictingDrugs: ['Iohexol', 'Iopamidol', 'Povidone-iodine'],
  },
  {
    allergen: 'Latex',
    matches: /latex/i,
    conflictingDrugs: [], // primarily a device allergy, included for completeness
  },
];

const matchesAny = (medName, drugList) => {
  if (!medName) return null;
  const lower = String(medName).toLowerCase();
  return drugList.find((d) => lower.includes(d.toLowerCase())) || null;
};

/**
 * Check a list of patient allergies against a single medication.
 *
 * @param {string} medicationName - the drug being prescribed
 * @param {Array<{ substance: string, severity?: string }>} allergies - patient.allergies array
 * @returns {{ warnings: Array<{ allergen, severity, matchedDrug, message }>, blocked: boolean }}
 *   warnings: human-readable messages to surface to the doctor
 *   blocked: true if any matching allergy is severity 'life-threatening'
 *            (caller may still allow override, but UI should warn loudly)
 */
const checkAllergies = (medicationName, allergies = []) => {
  if (!medicationName || !Array.isArray(allergies) || allergies.length === 0) {
    return { warnings: [], blocked: false };
  }

  const warnings = [];
  let blocked = false;

  for (const allergy of allergies) {
    const substance = allergy.substance || '';
    if (!substance) continue;

    const rule = RULES.find((r) => r.matches.test(substance));
    if (!rule) continue;

    const matchedDrug = matchesAny(medicationName, rule.conflictingDrugs);
    if (matchedDrug) {
      const severity = (allergy.severity || 'mild').toLowerCase();
      if (severity === 'life-threatening' || severity === 'severe') blocked = true;
      warnings.push({
        allergen: rule.allergen,
        severity,
        matchedDrug,
        patientReportedSubstance: substance,
        message: `Patient reported ${severity} allergy to ${substance}. ${matchedDrug} is in the ${rule.allergen} class.`,
      });
    }
  }

  return { warnings, blocked };
};

module.exports = { checkAllergies };
