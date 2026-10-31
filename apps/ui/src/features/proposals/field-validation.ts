/**
 * Field-type validation, input filtering, and formatting for Proposal Templates and Documents.
 * Enforces text, number, currency (INR), date (DD/MM/YYYY), email, and phone rules.
 */

const INR_FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

/**
 * Checks if a string is a valid date strictly in DD/MM/YYYY format.
 * Rejects impossible dates like 31/02/2026, 29/02/2025, 31/04/2026.
 */
export function isValidDmyDate(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== "string") return false;
  const trimmed = dateStr.trim();
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;

  const day = parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10);
  const year = parseInt(match[3]!, 10);

  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;

  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [
    31,
    isLeapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];

  const maxDays = daysInMonth[month - 1];
  if (!maxDays || day < 1 || day > maxDays) return false;

  return true;
}

/**
 * Normalizes a date string to DD/MM/YYYY format.
 * Handles both already-formatted DD/MM/YYYY and ISO YYYY-MM-DD.
 */
export function formatDmyDate(val: unknown): string {
  if (val === null || val === undefined) return "—";
  const str = String(val).trim();
  if (!str) return "—";
  if (isValidDmyDate(str)) return str;

  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const y = isoMatch[1]!;
    const m = isoMatch[2]!;
    const d = isoMatch[3]!;
    const dmy = `${d}/${m}/${y}`;
    if (isValidDmyDate(dmy)) return dmy;
  }

  return str;
}

/**
 * Checks if a string is a valid completed number (integer or decimal, optionally negative).
 */
export function isValidNumber(val: string): boolean {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim();
  return /^-?\d+(\.\d+)?$/.test(trimmed) && !isNaN(Number(trimmed));
}

/**
 * Checks if a string is a valid currency amount (positive number with up to 2 decimal places).
 */
export function isValidCurrency(val: string): boolean {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim();
  return /^\d+(\.\d{1,2})?$/.test(trimmed) && !isNaN(Number(trimmed));
}

/**
 * Checks if a string is a valid email address.
 */
export function isValidEmail(val: string): boolean {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim();
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed);
}

/**
 * Extracts national digits from a phone string.
 * If the string starts with country prefix "+91", strips the country code "91"
 * and returns the remaining digits.
 * Otherwise returns all digits in the string.
 */
export function getPhoneNationalDigits(val: string): string {
  if (!val || typeof val !== "string") return "";
  const trimmed = val.trim();
  if (trimmed.startsWith("+91")) {
    const withoutPrefix = trimmed.slice(3);
    return withoutPrefix.replace(/\D/g, "");
  }
  if (trimmed.startsWith("+")) {
    const digits = trimmed.replace(/\D/g, "");
    if (digits.startsWith("91") && digits.length > 2) {
      return digits.slice(2);
    }
    return digits;
  }
  return trimmed.replace(/\D/g, "");
}

/**
 * Checks if a string is a valid phone number.
 * Accepts exactly 10 digits for the national number.
 * Allows optional leading +91, spaces, hyphens, and parentheses.
 * Rejects alphabetic characters and numbers shorter or longer than 10 digits.
 */
export function isValidPhone(val: string): boolean {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (/[a-zA-Z]/.test(trimmed)) return false;
  if (!/^(\+?[0-9\s\-()]+)$/.test(trimmed)) return false;
  const nationalDigits = getPhoneNationalDigits(trimmed);
  return nationalDigits.length === 10;
}

/**
 * Safely parses a numeric value without treating arbitrary text or invalid input as 0.
 * Returns null if the value is not a valid number.
 */
export function parseNumericValue(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (!str) return null;
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    const num = Number(str);
    if (!isNaN(num)) return num;
  }
  return null;
}

/**
 * Formats a valid numeric amount as Indian Rupees (INR).
 */
export function formatINR(val: unknown): string {
  const num = parseNumericValue(val);
  if (num === null) return val ? String(val) : "—";
  return INR_FORMATTER.format(num);
}

/**
 * Validates whether an incoming keystroke / text change should be allowed into the input.
 * Prevents invalid characters from ever being typed or pasted.
 */
export function filterTypedValue(
  type: "text" | "number" | "currency" | "date" | "email" | "phone",
  newValue: string,
): boolean {
  if (newValue === "") return true;

  switch (type) {
    case "number":
      // Allows typing intermediate values like "-", ".", "-.", "-0."
      return /^-?\d*(\.\d*)?$/.test(newValue);
    case "currency":
      // Non-negative, allows typing intermediate "." or up to 2 decimal places
      return /^\d*(\.\d{0,2})?$/.test(newValue);
    case "date":
      // Allow only digits and slashes, max 10 characters
      return /^[0-9/]{0,10}$/.test(newValue);
    case "phone": {
      // Reject any alphabetic characters
      if (/[a-zA-Z]/.test(newValue)) return false;
      // Allow only +, digits, spaces, hyphens, parentheses
      if (!/^(\+?[0-9\s\-()]*)$/.test(newValue)) return false;
      // Reject entering or pasting additional digits beyond the 10 national digits limit
      const nationalDigits = getPhoneNationalDigits(newValue);
      if (nationalDigits.length > 10) return false;
      return true;
    }
    case "email":
    case "text":
    default:
      return true;
  }
}

/**
 * Returns a human-friendly validation error message if the completed field value is invalid.
 * Empty string is considered valid for optional fields.
 */
export function getFieldValidationError(
  type: "text" | "number" | "currency" | "date" | "email" | "phone",
  value: string,
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  switch (type) {
    case "number":
      return isValidNumber(trimmed) ? null : "Please enter a valid number";
    case "currency":
      return isValidCurrency(trimmed)
        ? null
        : "Please enter a valid amount (e.g. 50000 or 1250.50)";
    case "date":
      return isValidDmyDate(trimmed)
        ? null
        : "Please enter a valid date in DD/MM/YYYY format";
    case "email":
      return isValidEmail(trimmed)
        ? null
        : "Please enter a valid email address (e.g. name@company.com)";
    case "phone":
      return isValidPhone(trimmed)
        ? null
        : "Please enter a valid 10-digit phone number";
    case "text":
    default:
      return null;
  }
}
