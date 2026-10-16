/** Live keystroke sanitizers mirroring the onboarding wizard's pattern
 * (apps/ui/src/features/onboarding/components/OnboardingWizard.tsx) — shared
 * here so every sales-settings form applies the same rules instead of each
 * re-deriving its own regex. */

/** Letters, spaces, and . ' - only. */
export const sanitizeName = (raw: string) => raw.replace(/[^A-Za-z .'-]/g, "");

/** Digits only, capped at 10 (Indian mobile number length). */
export const sanitizePhone = (raw: string) =>
  raw.replace(/\D/g, "").slice(0, 10);

/** Digits only, capped at 6 (pincode length). */
export const sanitizePincode = (raw: string) =>
  raw.replace(/\D/g, "").slice(0, 6);

/** Alphanumeric only, uppercased, capped at `max` — for codes like IFSC/PAN/GSTIN. */
export const sanitizeCode = (raw: string, max: number) =>
  raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, max);

/** Digits only, capped at `max` — for numeric-only codes like account numbers. */
export const sanitizeDigits = (raw: string, max: number) =>
  raw.replace(/\D/g, "").slice(0, max);
