import { z } from "zod";

/**
 * Field formats shared by every form (onboarding, new hire, Sales
 * customers...): one pattern and one message each, so the same kind of
 * field is validated the same way everywhere. The API DTOs mirror these.
 */

/** Letters, spaces, and . ' - only — no digits or other symbols. */
export const NAME_PATTERN = /^[A-Za-z][A-Za-z .'-]*$/;
export const NAME_MESSAGE = "Enter a valid name (letters only).";

/** An Indian mobile number: 10 digits starting with 6–9. */
export const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/;
export const INDIAN_MOBILE_MESSAGE =
  "Enter a valid 10-digit mobile number starting with 6 to 9.";

export const PINCODE_PATTERN = /^[1-9]\d{5}$/;
export const PINCODE_MESSAGE = "Enter a valid 6-digit pincode.";

export const BANK_ACCOUNT_PATTERN = /^\d{9,18}$/;
export const BANK_ACCOUNT_MESSAGE = "Account number must be 9 to 18 digits.";

export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const IFSC_MESSAGE =
  "Enter a valid IFSC code (4 letters, 0, then 6 letters or digits).";

export const PAN_PATTERN = /^[A-Z]{5}\d{4}[A-Z]$/;
export const PAN_MESSAGE =
  "PAN must be 5 letters, 4 digits, then 1 letter (for example ABCDE1234F).";

export const mobileField = z
  .string()
  .trim()
  .regex(INDIAN_MOBILE_PATTERN, INDIAN_MOBILE_MESSAGE);

export const requiredText = (max = 100) =>
  z
    .string()
    .trim()
    .min(1, "This field is required.")
    .max(max, `Must be at most ${max} characters.`);

export const requiredName = (max = 100) =>
  requiredText(max).regex(NAME_PATTERN, NAME_MESSAGE);

/** Same character set as requiredName, but absent/empty is fine. */
export const optionalName = (max = 100) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters.`)
    .regex(NAME_PATTERN, NAME_MESSAGE)
    .or(z.literal(""))
    .optional();

export const pincodeField = z
  .string()
  .trim()
  .regex(PINCODE_PATTERN, PINCODE_MESSAGE);

export const bankAccountField = z
  .string()
  .trim()
  .regex(BANK_ACCOUNT_PATTERN, BANK_ACCOUNT_MESSAGE);

export const ifscField = z
  .string()
  .trim()
  .toUpperCase()
  .regex(IFSC_PATTERN, IFSC_MESSAGE);

export const panField = z
  .string()
  .trim()
  .toUpperCase()
  .regex(PAN_PATTERN, PAN_MESSAGE);

/** The default (and Indian) mobile country code. */
export const INDIA_CALLING_CODE = "+91";

/** Supported mobile country calling codes. Mirrors CALLING_CODE_COUNTRIES in
 * apps/api/src/common/dto/field-formats.ts (the API rejects anything else). */
export const CALLING_CODES: ReadonlyArray<{ code: string; country: string }> = [
  { code: "+91", country: "India" },
  { code: "+1", country: "United States / Canada" },
  { code: "+44", country: "United Kingdom" },
  { code: "+971", country: "United Arab Emirates" },
  { code: "+966", country: "Saudi Arabia" },
  { code: "+974", country: "Qatar" },
  { code: "+968", country: "Oman" },
  { code: "+965", country: "Kuwait" },
  { code: "+973", country: "Bahrain" },
  { code: "+65", country: "Singapore" },
  { code: "+60", country: "Malaysia" },
  { code: "+61", country: "Australia" },
  { code: "+64", country: "New Zealand" },
  { code: "+49", country: "Germany" },
  { code: "+33", country: "France" },
  { code: "+39", country: "Italy" },
  { code: "+31", country: "Netherlands" },
  { code: "+81", country: "Japan" },
  { code: "+82", country: "South Korea" },
  { code: "+86", country: "China" },
  { code: "+94", country: "Sri Lanka" },
  { code: "+977", country: "Nepal" },
  { code: "+880", country: "Bangladesh" },
  { code: "+27", country: "South Africa" },
];

export const ANY_MOBILE_PATTERN = /^\d{6,15}$/;
export const ANY_MOBILE_MESSAGE = "Enter 6 to 15 digits.";

/** The mobile rule for a country code: `+91` → 10 digits starting 6–9 (the
 * onboarding rule); other codes → 6–15 digits. */
export function mobileFieldFor(callingCode: string) {
  return callingCode === INDIA_CALLING_CODE
    ? mobileField
    : z.string().trim().regex(ANY_MOBILE_PATTERN, ANY_MOBILE_MESSAGE);
}

/** The longest mobile number a country code allows (for `maxLength`). */
export function mobileMaxLength(callingCode: string): number {
  return callingCode === INDIA_CALLING_CODE ? 10 : 15;
}
