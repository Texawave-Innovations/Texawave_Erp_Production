/**
 * Field formats shared by every module's DTOs (onboarding profile, Sales
 * customers...): one pattern and one message each, so the same kind of
 * field is validated the same way everywhere. Mirrored for forms by
 * packages/core/src/schemas/fields.ts.
 */
export const FIELD_FORMAT = {
  /** An Indian mobile number: 10 digits starting with 6–9. */
  mobile: /^[6-9]\d{9}$/,
  pincode: /^[1-9]\d{5}$/,
  accountNumber: /^\d{9,18}$/,
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  pan: /^[A-Z]{5}\d{4}[A-Z]$/,
  /** Letters, spaces, and . ' - (e.g. "Mary Jane O'Brien-Smith"). */
  name: /^[A-Za-z][A-Za-z .'-]*$/,
  /** Loose contact number: 6–20 of digits, + ( ) - and space. */
  phone: /^[0-9+ ()-]{6,20}$/,
  gstin: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
  aadhaar: /^\d{12}$/,
  /** PF / UAN number. */
  uan: /^\d{12}$/,
  esi: /^\d{17}$/,
  /** YYYY-MM-DD (shape only). */
  isoDate: /^\d{4}-\d{2}-\d{2}$/,
  /** YYYY-MM. */
  month: /^\d{4}-(0[1-9]|1[0-2])$/,
  /** Financial year, e.g. 2025-26. */
  financialYear: /^[0-9]{4}-[0-9]{2}$/,
  /** 24-hour HH:MM. */
  time: /^([01]\d|2[0-3]):[0-5]\d$/,
} as const;

export const FIELD_MESSAGE = {
  mobile: "Enter a valid 10-digit mobile number starting with 6 to 9.",
  pincode: "Enter a valid 6-digit pincode.",
  accountNumber: "Account number must be 9 to 18 digits.",
  ifsc: "Enter a valid IFSC code (4 letters, 0, then 6 letters or digits).",
  pan: "PAN must be 5 letters, 4 digits, then 1 letter (for example ABCDE1234F).",
  name: "Enter a valid name (letters only).",
  phone: "phone must be 6-20 digits/+()- characters",
  gstin: "Invalid GSTIN format. Expected standard 15-character Indian GSTIN.",
  aadhaar: "Aadhaar number must be exactly 12 digits.",
  uan: "PF (UAN) number must be exactly 12 digits.",
  esi: "ESI number must be exactly 17 digits.",
  isoDate: "must be YYYY-MM-DD",
  month: "must be YYYY-MM",
  financialYear: "must be a financial year like 2025-26",
  time: "must be HH:MM (24-hour)",
} as const;

/** The default (and Indian) mobile country code. */
export const INDIA_CALLING_CODE = "+91";

/**
 * Supported mobile country calling codes → ISO 3166-1 alpha-2 country (a
 * code shared by several countries maps to the main one: `+1` → `US`). Add
 * a row here to support a new country; anything not listed is rejected.
 * Mirrored for forms by packages/core/src/schemas/fields.ts.
 */
export const CALLING_CODE_COUNTRIES: Readonly<Record<string, string>> = {
  "+91": "IN",
  "+1": "US",
  "+44": "GB",
  "+971": "AE",
  "+966": "SA",
  "+974": "QA",
  "+968": "OM",
  "+965": "KW",
  "+973": "BH",
  "+65": "SG",
  "+60": "MY",
  "+61": "AU",
  "+64": "NZ",
  "+49": "DE",
  "+33": "FR",
  "+39": "IT",
  "+31": "NL",
  "+81": "JP",
  "+82": "KR",
  "+86": "CN",
  "+94": "LK",
  "+977": "NP",
  "+880": "BD",
  "+27": "ZA",
};

export const CALLING_CODES = Object.keys(CALLING_CODE_COUNTRIES);

/** Any mobile number: 6–15 digits (an Indian one is stricter, see below). */
export const ANY_MOBILE_PATTERN = /^\d{6,15}$/;
export const ANY_MOBILE_MESSAGE = "Enter 6 to 15 digits.";

/** The mobile format for a country code: `+91` → 10 digits starting 6–9;
 * other codes → 6–15 digits. */
export function mobileFormatFor(callingCode: string): {
  pattern: RegExp;
  message: string;
} {
  return callingCode === INDIA_CALLING_CODE
    ? { pattern: FIELD_FORMAT.mobile, message: FIELD_MESSAGE.mobile }
    : { pattern: ANY_MOBILE_PATTERN, message: ANY_MOBILE_MESSAGE };
}
