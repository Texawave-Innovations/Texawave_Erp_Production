import { z } from "zod";

/** Mirrors apps/api/src/modules/employee-self-service/profile/dto/*.ts — same
 * formats and messages, so the wizard rejects exactly what the API rejects. */
const mobile = z
  .string()
  .trim()
  .regex(
    /^[6-9]\d{9}$/,
    "Enter a valid 10-digit mobile number starting with 6 to 9.",
  );
const requiredText = (max = 100) =>
  z
    .string()
    .trim()
    .min(1, "This field is required.")
    .max(max, `Must be at most ${max} characters.`);
const optionalText = (max = 100) =>
  z.string().trim().max(max, `Must be at most ${max} characters.`);
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
  emergencyContactName: requiredText(),
  emergencyContactRelation: requiredText(),
  emergencyContactPhone: mobile,
  fatherName: requiredText(),
  fatherPhone: mobile,
  motherName: requiredText(),
  motherPhone: mobile,
});
export type PersonalDetailsValues = z.infer<typeof personalDetailsSchema>;

export const addressSchema = z.object({
  addressLine: requiredText(200),
  areaLocality: optionalText(),
  district: requiredText(),
  city: requiredText(),
  state: requiredText(),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit pincode."),
});
export type AddressValues = z.infer<typeof addressSchema>;

export const bankDetailsSchema = z.object({
  accountHolderName: requiredText(),
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
  bankName: requiredText(),
  branchName: optionalText().optional(),
});
export type BankDetailsValues = z.infer<typeof bankDetailsSchema>;

export const governmentIdsSchema = z.object({
  aadhaarNumber: z
    .string()
    .trim()
    .regex(/^\d{12}$/, "Aadhaar number must be exactly 12 digits."),
  panNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z]{5}\d{4}[A-Z]$/,
      "PAN must be 5 letters, 4 digits, then 1 letter (for example ABCDE1234F).",
    ),
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
