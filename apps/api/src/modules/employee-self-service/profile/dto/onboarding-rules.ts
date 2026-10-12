import { applyDecorators } from "@nestjs/common";
import { ApiProperty } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;
export const MARITAL_STATUSES = ["SINGLE", "MARRIED", "OTHER"] as const;
export const BLOOD_GROUPS = [
  "A+",
  "A-",
  "B+",
  "B-",
  "AB+",
  "AB-",
  "O+",
  "O-",
] as const;

export const DOCUMENT_TYPES = [
  "PROFILE_PHOTO",
  "RESUME",
  "AADHAAR",
  "PAN",
  "BANK_STATEMENT",
  "CERT_10TH",
  "CERT_12TH",
  "CERT_GRADUATION",
  "CERT_POST_GRADUATION",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export function isDocumentType(value: string): value is DocumentType {
  return (DOCUMENT_TYPES as readonly string[]).includes(value);
}

export const FORMAT = {
  mobile: /^[6-9]\d{9}$/,
  pincode: /^[1-9]\d{5}$/,
  accountNumber: /^\d{9,18}$/,
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  aadhaar: /^\d{12}$/,
  pan: /^[A-Z]{5}\d{4}[A-Z]$/,
  esi: /^\d{17}$/,
  pf: /^\d{12}$/,
  /** Letters, spaces, and . ' - (e.g. "Mary Jane O'Brien-Smith"). No digits or other symbols. */
  name: /^[A-Za-z][A-Za-z .'-]*$/,
} as const;

const MSG = {
  mobile: "Enter a valid 10-digit mobile number starting with 6 to 9.",
  pincode: "Enter a valid 6-digit pincode.",
  accountNumber: "Account number must be 9 to 18 digits.",
  ifsc: "Enter a valid IFSC code (4 letters, 0, then 6 letters or digits).",
  aadhaar: "Aadhaar number must be exactly 12 digits.",
  pan: "PAN must be 5 letters, 4 digits, then 1 letter (for example ABCDE1234F).",
  esi: "ESI number must be exactly 17 digits.",
  pf: "PF (UAN) number must be exactly 12 digits.",
  name: "Enter a valid name (letters only).",
} as const;

/** A required text field: a non-empty string with a sensible length cap. */
export function RequiredText(max = 100) {
  return applyDecorators(
    ApiProperty(),
    IsString({ message: "Must be text." }),
    MinLength(1, { message: "This field is required." }),
    MaxLength(max, { message: `Must be at most ${max} characters.` }),
  );
}

/** An optional text field with the same length cap when it is present. */
export function OptionalText(max = 100) {
  return applyDecorators(
    ApiProperty({ required: false }),
    IsOptional(),
    IsString({ message: "Must be text." }),
    MaxLength(max, { message: `Must be at most ${max} characters.` }),
  );
}

/** A required person's name: letters, spaces, and . ' - only — no digits or symbols. */
export function RequiredName(max = 100) {
  return applyDecorators(
    ApiProperty(),
    IsString({ message: "Must be text." }),
    MinLength(1, { message: "This field is required." }),
    MaxLength(max, { message: `Must be at most ${max} characters.` }),
    Matches(FORMAT.name, { message: MSG.name }),
  );
}

/** An optional name-shaped field (same character set as RequiredName) —
 * absent or empty is fine, but a non-empty value must still be letters only. */
export function OptionalName(max = 100) {
  return applyDecorators(
    ApiProperty({ required: false }),
    IsOptional(),
    IsString({ message: "Must be text." }),
    MaxLength(max, { message: `Must be at most ${max} characters.` }),
    Matches(FORMAT.name, { message: MSG.name }),
  );
}

export function Pattern(regex: RegExp, message: string) {
  return Matches(regex, { message });
}

export const MOBILE = { regex: FORMAT.mobile, message: MSG.mobile };
export const PINCODE = { regex: FORMAT.pincode, message: MSG.pincode };
export const ACCOUNT_NUMBER = {
  regex: FORMAT.accountNumber,
  message: MSG.accountNumber,
};
export const IFSC = { regex: FORMAT.ifsc, message: MSG.ifsc };
export const AADHAAR = { regex: FORMAT.aadhaar, message: MSG.aadhaar };
export const PAN = { regex: FORMAT.pan, message: MSG.pan };
export const ESI = { regex: FORMAT.esi, message: MSG.esi };
export const PF = { regex: FORMAT.pf, message: MSG.pf };
