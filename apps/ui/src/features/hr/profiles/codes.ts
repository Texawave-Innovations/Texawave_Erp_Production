/**
 * HR profiles and the onboarding wizard write the same personal-details row,
 * so these fields hold the wizard's codes (apps/api/.../onboarding-rules.ts
 * GENDERS / MARITAL_STATUSES / BLOOD_GROUPS). The API also accepts common
 * spellings, but the UI offers the codes directly.
 */
export interface CodeOption {
  value: string;
  label: string;
}

export const GENDER_OPTIONS: readonly CodeOption[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

export const MARITAL_OPTIONS: readonly CodeOption[] = [
  { value: "SINGLE", label: "Single" },
  { value: "MARRIED", label: "Married" },
  { value: "OTHER", label: "Other" },
];

export const BLOOD_GROUP_OPTIONS: readonly CodeOption[] = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
].map((v) => ({ value: v, label: v }));

/** Display label for a stored code; an unrecognised legacy value is shown as-is. */
export function codeLabel(
  options: readonly CodeOption[],
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  return options.find((o) => o.value === value)?.label ?? value;
}
