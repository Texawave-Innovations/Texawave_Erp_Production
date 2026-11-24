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

/* ------------------------------------------------------------------ *
 * Further shared formats (the strictest rule that already existed for
 * each). The API mirrors these in apps/api/src/common/dto/field-formats.ts.
 * ------------------------------------------------------------------ */

/** Loose contact number (landline / international): 6–20 of digits, + ( ) - and space. */
export const PHONE_PATTERN = /^[0-9+ ()-]{6,20}$/;
export const PHONE_MESSAGE = "Phone must be 6–20 digits, spaces, + ( ) or -.";

export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const GSTIN_MESSAGE = "Enter a valid 15-character GSTIN.";

export const AADHAAR_PATTERN = /^\d{12}$/;
export const AADHAAR_MESSAGE = "Aadhaar number must be exactly 12 digits.";

/** PF / UAN number. */
export const UAN_PATTERN = /^\d{12}$/;
export const UAN_MESSAGE = "PF (UAN) number must be exactly 12 digits.";

export const ESI_PATTERN = /^\d{17}$/;
export const ESI_MESSAGE = "ESI number must be exactly 17 digits.";

/** The shape every master-data / entity code must have (mirrored by a DB CHECK). */
export const ENTITY_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,29}$/;
export const ENTITY_CODE_MESSAGE =
  "Code must be 2-30 characters: upper-case letters, digits or underscore, starting with a letter.";

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const ISO_DATE_MESSAGE = "Use a valid date (YYYY-MM-DD).";

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
export const MONTH_MESSAGE = "Use a valid month (YYYY-MM).";

/** Indian financial year, e.g. 2025-26. */
export const FINANCIAL_YEAR_PATTERN = /^[0-9]{4}-[0-9]{2}$/;
export const FINANCIAL_YEAR_MESSAGE = "Use a financial year like 2025-26.";

/** 24-hour HH:MM. */
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const TIME_MESSAGE = "Use a valid 24-hour time (HH:MM).";

export const EMAIL_MESSAGE = "Enter a valid email address.";
export const REQUIRED_MESSAGE = "This field is required.";

export const phoneField = z.string().trim().regex(PHONE_PATTERN, PHONE_MESSAGE);
export const gstinField = z
  .string()
  .trim()
  .toUpperCase()
  .regex(GSTIN_PATTERN, GSTIN_MESSAGE);
export const aadhaarField = z
  .string()
  .trim()
  .regex(AADHAAR_PATTERN, AADHAAR_MESSAGE);
export const uanField = z.string().trim().regex(UAN_PATTERN, UAN_MESSAGE);
export const esiField = z.string().trim().regex(ESI_PATTERN, ESI_MESSAGE);
export const isoDateField = z
  .string()
  .trim()
  .regex(ISO_DATE_PATTERN, ISO_DATE_MESSAGE);

/** The one email rule: trimmed, at most 254 characters, valid address. */
export const emailField = z
  .string()
  .trim()
  .max(254, "Must be at most 254 characters.")
  .email(EMAIL_MESSAGE);
/** Same rule, but absent/empty is fine. */
export const optionalEmail = emailField.or(z.literal("")).optional();

/* Input masks — strip characters the matching pattern would reject, so a
 * field's filter and its validator cannot drift apart. */
export const sanitizeName = (raw: string) => raw.replace(/[^A-Za-z .'-]/g, "");
export const sanitizeDigits = (raw: string, max?: number) => {
  const digits = raw.replace(/\D/g, "");
  return max === undefined ? digits : digits.slice(0, max);
};
export const sanitizeMobile = (raw: string) => sanitizeDigits(raw, 10);
