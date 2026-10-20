import { SUPPLIER_STATUSES } from "@texawave-erp/api-types";
import { z } from "zod";

/** Shared client-side validation for SCM Suppliers — mirrors
 * apps/api/src/modules/scm/suppliers/dto/supplier.dto.ts field for field.
 * Patterns are the legacy `formValidators.ts` ones. */
export const GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

/** Legacy `src/constants/gst.ts`. */
export const INDIAN_STATES: readonly string[] = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Lakshadweep",
  "Puducherry",
];

/** First two GSTIN digits -> state (legacy `GST_STATE_CODES`). */
export const GST_STATE_CODES: Readonly<Record<string, string>> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Dadra and Nagar Haveli and Daman and Diu",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "28": "Andhra Pradesh",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
};

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const createSupplierSchema = z.object({
  supplierCode: z.string().trim().min(1, "Supplier code is required").max(50),
  companyName: z.string().trim().min(1, "Company name is required").max(200),
  type: optionalText(100),
  status: z.enum(SUPPLIER_STATUSES).default("Active"),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(GSTIN_REGEX, "Invalid GSTIN format")
    .optional()
    .or(z.literal("")),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(PAN_REGEX, "Invalid PAN format (e.g., ABCDE1234F)")
    .optional()
    .or(z.literal("")),
  contactPerson: z
    .string()
    .trim()
    .min(1, "Primary contact name is required")
    .max(150),
  phone: z
    .string()
    .trim()
    .regex(/^\d{1,15}$/, "Phone must be digits only (max 15)")
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .trim()
    .max(200)
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  street: optionalText(300),
  city: optionalText(100),
  state: optionalText(100),
  country: optionalText(100),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{1,6}$/, "Postal code must be digits only (max 6)")
    .optional()
    .or(z.literal("")),
  paymentTerms: optionalText(100),
  creditLimit: z.number().min(0, "Credit limit cannot be negative").optional(),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z]{3}$/,
      "Currency must be a 3-letter ISO code (e.g., INR, USD)",
    ),
  leadTimeDays: z
    .number()
    .int("Lead time must be a whole number")
    .min(0, "Lead time cannot be negative")
    .optional(),
  rating: z
    .number()
    .int()
    .min(1, "Rating must be between 1 and 5")
    .max(5, "Rating must be between 1 and 5")
    .nullable()
    .optional(),
  notes: optionalText(2000),
});

export type CreateSupplierFormValues = z.infer<typeof createSupplierSchema>;
