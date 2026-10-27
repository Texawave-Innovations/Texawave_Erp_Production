import {
  FINANCE_GST_ENTRY_TYPES,
  FINANCE_GST_SOURCE_TYPES,
} from "@texawave-erp/api-types";
import { z } from "zod";

/**
 * Standard 15-character Indian Goods and Services Tax Identification Number (GSTIN) regex:
 * 2 state digits + 5 PAN uppercase letters + 4 PAN digits + 1 PAN letter + 1 entity code + 'Z' + 1 checksum digit/char.
 */
export const INDIAN_GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Standard GST tax period regex in YYYY-MM format.
 */
export const GST_PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export const createGstEntrySchema = z.object({
  gstin: z
    .string()
    .trim()
    .regex(
      INDIAN_GSTIN_REGEX,
      "Enter a valid 15-character GSTIN (e.g. 29AABCT1332L1ZV)",
    ),
  period: z
    .string()
    .trim()
    .regex(GST_PERIOD_REGEX, "Period must be in YYYY-MM format (e.g. 2026-10)"),
  entryType: z.enum(FINANCE_GST_ENTRY_TYPES),
  sourceType: z.enum(FINANCE_GST_SOURCE_TYPES).default("MANUAL"),
  sourceReference: z
    .string()
    .trim()
    .min(1, "Invoice or bill reference number is required")
    .max(100, "Reference must be 100 characters or fewer"),
  hsnSacCode: z
    .string()
    .trim()
    .max(20, "HSN/SAC code must be 20 characters or fewer")
    .optional()
    .nullable(),
  taxableAmount: z
    .number()
    .positive("Taxable base amount must be greater than zero")
    .min(0.01, "Taxable amount must be at least 0.01"),
  cgstRate: z.number().min(0).default(0),
  cgstAmount: z.number().min(0).default(0),
  sgstRate: z.number().min(0).default(0),
  sgstAmount: z.number().min(0).default(0),
  igstRate: z.number().min(0).default(0),
  igstAmount: z.number().min(0).default(0),
  totalTaxAmount: z.number().min(0).default(0),
  isProformaExcluded: z.boolean().default(false),
});

export type CreateGstEntryFormValues = z.infer<typeof createGstEntrySchema>;

export const counterpartGstEntrySchema = z.object({
  gstin: z
    .string()
    .trim()
    .regex(
      INDIAN_GSTIN_REGEX,
      "Enter a valid 15-character GSTIN (e.g. 29AABCT1332L1ZV)",
    ),
  invoiceNumber: z
    .string()
    .trim()
    .min(1, "Invoice number is required")
    .max(100),
  invoiceDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invoice date must be in YYYY-MM-DD format")
    .optional(),
  taxableAmount: z.number().min(0, "Taxable amount must be 0 or positive"),
  cgstAmount: z.number().min(0).optional(),
  sgstAmount: z.number().min(0).optional(),
  igstAmount: z.number().min(0).optional(),
  totalTaxAmount: z.number().min(0, "Total tax must be 0 or positive"),
});

export const reconcileGstSchema = z.object({
  period: z
    .string()
    .trim()
    .regex(GST_PERIOD_REGEX, "Period must be in YYYY-MM format (e.g. 2026-10)"),
  persistReconciliation: z.boolean().default(true),
  counterpartEntries: z
    .array(counterpartGstEntrySchema)
    .min(
      1,
      "At least one counterpart GSTR-2B entry is required for reconciliation",
    ),
});

export type ReconcileGstFormValues = z.infer<typeof reconcileGstSchema>;
