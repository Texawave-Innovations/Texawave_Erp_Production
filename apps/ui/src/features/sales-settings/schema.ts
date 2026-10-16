import {
  optionalMobile,
  optionalName,
  optionalPan,
  optionalPincode,
  requiredName,
  requiredText,
} from "@texawave-erp/core";
import { z } from "zod";

/**
 * Feature-local zod schemas mirroring apps/api/src/modules/sales-settings/dto/*.ts
 * (Docs/CODING_STANDARDS.md "Frontend API/state/error standard") — kept
 * feature-local, not in packages/core, since nothing else references these
 * shapes yet (Docs/HOW_TO_ADD_A_MODULE.md "schema.ts").
 *
 * Field-level primitives (`requiredText`, etc.) are reused from
 * packages/core/src/schemas/onboarding.schema.ts rather than redefined here.
 */

/** Shared 0–100 percentage rule — used by both `salespersonSchema` and
 * `masterListItemSchema` so the two don't drift. */
const percent = z
  .number({ message: "Enter a valid number." })
  .min(0, "Must be 0 or more")
  .max(100, "Must be 100 or fewer");

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z]{1}[A-Z\d]{1}$/;

/** Mirrors the API's `IsImageDataUri` validator
 * (apps/api/src/common/dto/validators.ts) and the client's
 * `validateImageFile` file-picker check (../utils.ts) — a defense-in-depth
 * check on the data URI itself (size from its base64 payload length, format
 * from its declared mime), in case `imageDataUri`/`logoDataUri` end up set
 * by something other than the file picker. The server remains the source of
 * truth since it checks the decoded bytes' own magic numbers. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const imageDataUri = (message: string) =>
  z
    .string()
    .min(1, message)
    .regex(
      /^data:image\/(png|jpe?g);base64,/i,
      "Only PNG or JPG images are accepted.",
    )
    .refine((value) => {
      const base64 = value.slice(value.indexOf(",") + 1);
      const padding = (base64.match(/=+$/)?.[0].length ?? 0) as 0 | 1 | 2;
      const bytes = (base64.length * 3) / 4 - padding;
      return bytes <= MAX_UPLOAD_BYTES;
    }, "Image must be 5 MB or smaller.");

export const companyDetailSchema = z.object({
  name: requiredName(200),
  phone: optionalMobile,
  email: z
    .string()
    .trim()
    .max(200)
    .email("Enter a valid email address.")
    .optional()
    .or(z.literal("")),
  website: z.string().max(200).optional().or(z.literal("")),
  addressLine1: z.string().max(200).optional().or(z.literal("")),
  addressLine2: z.string().max(200).optional().or(z.literal("")),
  city: optionalName(100),
  state: optionalName(100),
  pincode: optionalPincode,
  country: optionalName(100),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(GSTIN_RE, "Enter a valid 15-character GSTIN.")
    .optional()
    .or(z.literal("")),
  pan: optionalPan,
  logoDataUri: imageDataUri("A logo is required").optional().or(z.literal("")),
});
export type CompanyDetailFormValues = z.infer<typeof companyDetailSchema>;

export const documentNumberingSchema = z.object({
  prefix: z.string().max(20, "20 characters or fewer"),
  padding: z
    .number()
    .int()
    .min(1, "Must be at least 1")
    .max(10, "Must be 10 or fewer")
    .optional(),
});
export type DocumentNumberingFormValues = z.infer<
  typeof documentNumberingSchema
>;

export const bankAccountSchema = z.object({
  bankName: requiredName(200),
  accountHolderName: requiredName(200),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{9,18}$/, "Account number must be 9 to 18 digits."),
  ifscCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z]{4}0[A-Z0-9]{6}$/,
      "Enter a valid IFSC code (4 letters, 0, then 6 letters or digits).",
    ),
  branchName: optionalName(200),
  isPrimary: z.boolean().optional(),
});
export type BankAccountFormValues = z.infer<typeof bankAccountSchema>;

export const authorizedSignatorySchema = z.object({
  name: optionalName(200),
  designation: optionalName(200),
});
export type AuthorizedSignatoryFormValues = z.infer<
  typeof authorizedSignatorySchema
>;

export const salespersonSchema = z.object({
  name: requiredName(200),
  code: z.string().max(30).optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .max(200)
    .email("Enter a valid email address.")
    .optional()
    .or(z.literal("")),
  phone: optionalMobile,
  commissionPercent: percent.optional(),
});
export type SalespersonFormValues = z.infer<typeof salespersonSchema>;

export const sealSignatureSchema = z.object({
  title: requiredText(200),
  signatoryName: optionalName(200),
  designation: optionalName(200),
  imageDataUri: imageDataUri("An image is required"),
});
export type SealSignatureFormValues = z.infer<typeof sealSignatureSchema>;

export const masterListItemSchema = z.object({
  value: requiredText(200),
  numericValue: percent.optional(),
});
export type MasterListItemFormValues = z.infer<typeof masterListItemSchema>;
