/**
 * Pure rules for employee profiles. No I/O.
 */

/** Trims, drops blanks and case-insensitive duplicates, keeps the first spelling
 * and the original order. `null` and `undefined` become `[]`. */
export function normalizeLanguages(
  input: readonly string[] | null | undefined,
): string[] {
  if (!input) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    const value = raw.trim();
    if (value === "") continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/**
 * HR and the onboarding wizard now write the same personal-details row, so HR
 * input is stored as the wizard's codes (GENDERS, MARITAL_STATUSES,
 * BLOOD_GROUPS in employee-self-service/profile/dto/onboarding-rules.ts).
 * Common spellings are accepted ("male", "M", "Married", "o+"). Returns
 * `undefined` for a value that matches no code, so the caller can reject it.
 */
const GENDER_ALIASES: Record<string, string> = {
  MALE: "MALE",
  M: "MALE",
  FEMALE: "FEMALE",
  F: "FEMALE",
  OTHER: "OTHER",
};
const MARITAL_ALIASES: Record<string, string> = {
  SINGLE: "SINGLE",
  UNMARRIED: "SINGLE",
  MARRIED: "MARRIED",
  OTHER: "OTHER",
};

export function toGenderCode(value: string): string | undefined {
  return GENDER_ALIASES[value.trim().toUpperCase()];
}

export function toMaritalCode(value: string): string | undefined {
  return MARITAL_ALIASES[value.trim().toUpperCase()];
}

export function toBloodGroupCode(
  value: string,
  allowed: readonly string[],
): string | undefined {
  const code = value.replace(/\s+/g, "").toUpperCase();
  return allowed.includes(code) ? code : undefined;
}

/** The audit trail records WHICH fields changed, never their values (sensitive
 * and personal data stay out of the log). Sorted for a stable record. */
export function changedFieldNames(patch: Record<string, unknown>): string[] {
  return Object.keys(patch).sort();
}
