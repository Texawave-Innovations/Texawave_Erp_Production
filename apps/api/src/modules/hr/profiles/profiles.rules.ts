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

/** The audit trail records WHICH fields changed, never their values (sensitive
 * and personal data stay out of the log). Sorted for a stable record. */
export function changedFieldNames(patch: Record<string, unknown>): string[] {
  return Object.keys(patch).sort();
}
