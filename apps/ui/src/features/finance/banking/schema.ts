import {
  FINANCE_BANK_ACCOUNT_TYPES,
  FINANCE_BANK_TRANSACTION_TYPES,
} from "@texawave-erp/api-types";
import { z } from "zod";

/**
 * Standard Indian Financial System Code (IFSC) regex:
 * 4 alphabetic uppercase bank code + strictly '0' + 6 alphanumeric branch code.
 * Matches canonical definition used in HR profiles and payroll (e.g. HDFC0001234, SBIN0001234).
 */
export const INDIAN_IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export const createBankAccountSchema = z.object({
  accountName: z
    .string()
    .trim()
    .min(1, "Account name is required")
    .max(100, "Account name must be 100 characters or fewer"),
  accountNumber: z
    .string()
    .trim()
    .min(1, "Account number is required")
    .max(16, "Account number must be 16 characters or fewer"),
  bankName: z
    .string()
    .trim()
    .min(1, "Bank name is required")
    .max(100, "Bank name must be 100 characters or fewer"),
  ifscCode: z
    .string()
    .trim()
    .regex(
      INDIAN_IFSC_REGEX,
      "Enter a valid 11-character Indian IFSC code (e.g. HDFC0001234)",
    ),
  branchName: z
    .string()
    .trim()
    .max(100, "Branch name must be 100 characters or fewer")
    .optional()
    .nullable(),
  accountType: z.enum(FINANCE_BANK_ACCOUNT_TYPES).default("CURRENT"),
  currency: z.string().trim().max(10).default("INR"),
  openingBalance: z
    .number()
    .min(0, "Opening balance must be 0 or positive")
    .default(0),
  glAccountId: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().default(true),
});

export type CreateBankAccountFormValues = z.infer<
  typeof createBankAccountSchema
>;

export const updateBankAccountSchema = z.object({
  accountName: z
    .string()
    .trim()
    .min(1, "Account name is required")
    .max(100, "Account name must be 100 characters or fewer")
    .optional(),
  bankName: z
    .string()
    .trim()
    .min(1, "Bank name is required")
    .max(100, "Bank name must be 100 characters or fewer")
    .optional(),
  ifscCode: z
    .string()
    .trim()
    .regex(
      INDIAN_IFSC_REGEX,
      "Enter a valid 11-character Indian IFSC code (e.g. HDFC0001234)",
    )
    .optional(),
  branchName: z
    .string()
    .trim()
    .max(100, "Branch name must be 100 characters or fewer")
    .optional()
    .nullable(),
  accountType: z.enum(FINANCE_BANK_ACCOUNT_TYPES).optional(),
  glAccountId: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
});

export type UpdateBankAccountFormValues = z.infer<
  typeof updateBankAccountSchema
>;

export const createBankTransactionSchema = z.object({
  bankAccountId: z
    .number()
    .int()
    .positive("Please select a target bank account"),
  transactionDate: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      "Transaction date must be in YYYY-MM-DD format",
    )
    .refine(
      (val) => val <= new Date().toISOString().slice(0, 10),
      "Transaction date cannot be in the future",
    ),
  transactionType: z.enum(FINANCE_BANK_TRANSACTION_TYPES),
  amount: z
    .number()
    .positive("Transaction amount must be greater than zero")
    .min(0.01, "Transaction amount must be at least 0.01"),
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(255, "Description must be 255 characters or fewer"),
  referenceNumber: z
    .string()
    .trim()
    .max(100, "Reference number must be 100 characters or fewer")
    .optional()
    .nullable(),
  counterGlAccountId: z.number().int().positive().optional().nullable(),
});

export type CreateBankTransactionFormValues = z.infer<
  typeof createBankTransactionSchema
>;

export const reconcileTransactionSchema = z.object({
  statementDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Statement date must be in YYYY-MM-DD format")
    .refine(
      (val) => val <= new Date().toISOString().slice(0, 10),
      "Statement date cannot be in the future",
    ),
  reconciliationReference: z
    .string()
    .trim()
    .max(100, "Reference must be 100 characters or fewer")
    .optional()
    .nullable(),
  matchedJournalEntryId: z.number().int().positive().optional().nullable(),
});

export type ReconcileTransactionFormValues = z.infer<
  typeof reconcileTransactionSchema
>;
