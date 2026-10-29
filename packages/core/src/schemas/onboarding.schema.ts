import { z } from "zod";
import {
  bankAccountField,
  ifscField,
  mobileField,
  optionalName,
  panField,
  pincodeField,
  requiredName,
  requiredText,
} from "./fields";

/** Mirrors apps/api/src/modules/employee-self-service/profile/dto/*.ts — same
 * formats and messages, so the wizard rejects exactly what the API rejects.
 * The shared field formats live in ./fields. */
const mobile = mobileField;
/** Same format as `mobile`, but absent/empty is fine. */
export const optionalMobile = mobile.or(z.literal("")).optional();
/** Same format as `pincodeField`, but absent/empty is fine. */
export const optionalPincode = pincodeField.or(z.literal("")).optional();
/** Same format as `panField`, but absent/empty is fine. */
export const optionalPan = panField.or(z.literal("")).optional();
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
  pincode: pincodeField,
});
export type AddressValues = z.infer<typeof addressSchema>;

export const bankDetailsSchema = z.object({
  accountHolderName: requiredName(),
  accountNumber: bankAccountField,
  ifsc: ifscField,
  bankName: requiredName(),
  branchName: optionalName(),
});
export type BankDetailsValues = z.infer<typeof bankDetailsSchema>;

export const governmentIdsSchema = z.object({
  aadhaarNumber: z
    .string()
    .trim()
    .regex(/^\d{12}$/, "Aadhaar number must be exactly 12 digits."),
  panNumber: panField,
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
