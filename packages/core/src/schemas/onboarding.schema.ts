import { z } from "zod";

/** Mirrors apps/api/src/modules/employee-self-service/profile/dto/*.ts — same
 * formats and messages, so the wizard rejects exactly what the API rejects.
 * Exported so other features validate phone numbers the same way instead of
 * hand-rolling their own regex. */
export const mobile = z
  .string()
  .trim()
  .regex(
    /^[6-9]\d{9}$/,
    "Enter a valid 10-digit mobile number starting with 6 to 9.",
  );
/** Same format as `mobile`, but absent/empty is fine. */
export const optionalMobile = mobile.or(z.literal("")).optional();
/** Shared "required, trimmed, bounded-length" string rule — reuse this
 * instead of hand-rolling `.trim().min(1).max()` elsewhere. */
export const requiredText = (max = 100) =>
  z
    .string()
    .trim()
    .min(1, "This field is required.")
    .max(max, `Must be at most ${max} characters.`);
export const NAME_RE = /^[A-Za-z][A-Za-z .'-]*$/;
export const NAME_MSG = "Enter a valid name (letters only).";
/** Letters, spaces, and . ' - only — no digits or other symbols. */
export const requiredName = (max = 100) =>
  requiredText(max).regex(NAME_RE, NAME_MSG);
/** Same character set as requiredName, but absent/empty is fine. */
export const optionalName = (max = 100) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters.`)
    .regex(NAME_RE, NAME_MSG)
    .or(z.literal(""))
    .optional();
const PINCODE_RE = /^[1-9]\d{5}$/;
export const pincode = z
  .string()
  .trim()
  .regex(PINCODE_RE, "Enter a valid 6-digit pincode.");
/** Same format as `pincode`, but absent/empty is fine. */
export const optionalPincode = pincode.or(z.literal("")).optional();
const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
const PAN_MSG =
  "PAN must be 5 letters, 4 digits, then 1 letter (for example ABCDE1234F).";
export const pan = z.string().trim().toUpperCase().regex(PAN_RE, PAN_MSG);
/** Same format as `pan`, but absent/empty is fine. */
export const optionalPan = pan.or(z.literal("")).optional();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date (YYYY-MM-DD).");

export const personalDetailsSchema = z.object({
  dateOfBirth: date,
  gender: z.enum(["MALE", "FEMALE", "OTHER"], { message: "Select a gender." }),
  maritalStatus: z.enum(["SINGLE", "MARRIED", "OTHER"]).optional(),
  bloodGroup: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
    .optional(),
  emergencyContactName: requiredName(),
  emergencyContactRelation: requiredName(),
  emergencyContactPhone: mobile,
  fatherName: requiredName(),
  fatherPhone: mobile,
  motherName: requiredName(),
  motherPhone: mobile,
});
export type PersonalDetailsValues = z.infer<typeof personalDetailsSchema>;

export const addressSchema = z.object({
  addressLine: requiredText(200),
  areaLocality: optionalName(),
  district: requiredName(),
  city: requiredName(),
  state: requiredName(),
  pincode,
});
export type AddressValues = z.infer<typeof addressSchema>;

export const bankDetailsSchema = z.object({
  accountHolderName: requiredName(),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{9,18}$/, "Account number must be 9 to 18 digits."),
  ifsc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z]{4}0[A-Z0-9]{6}$/,
      "Enter a valid IFSC code (4 letters, 0, then 6 letters or digits).",
    ),
  bankName: requiredName(),
  branchName: optionalName(),
});
export type BankDetailsValues = z.infer<typeof bankDetailsSchema>;

export const governmentIdsSchema = z.object({
  aadhaarNumber: z
    .string()
    .trim()
    .regex(/^\d{12}$/, "Aadhaar number must be exactly 12 digits."),
  panNumber: pan,
  esiNumber: z
    .string()
    .trim()
    .regex(/^\d{17}$/, "ESI number must be exactly 17 digits.")
    .or(z.literal(""))
    .optional(),
  pfNumber: z
    .string()
    .trim()
    .regex(/^\d{12}$/, "PF (UAN) number must be exactly 12 digits.")
    .or(z.literal(""))
    .optional(),
});
export type GovernmentIdsValues = z.infer<typeof governmentIdsSchema>;

/** Mirrors apps/api/.../profile/dto/family-member.dto.ts. */
export const familyMemberSchema = z.object({
  name: requiredName(),
  relation: requiredName(50),
  dateOfBirth: date.or(z.literal("")).optional(),
  contactPhone: mobile.or(z.literal("")).optional(),
});
export type FamilyMemberValues = z.infer<typeof familyMemberSchema>;
