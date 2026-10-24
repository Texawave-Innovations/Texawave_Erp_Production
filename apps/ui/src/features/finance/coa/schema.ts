import { FINANCE_ACCOUNT_TYPES } from "@texawave-erp/api-types";
import { z } from "zod";

export const createFinanceAccountSchema = z.object({
  accountCode: z
    .string()
    .trim()
    .min(1, "Account code is required")
    .max(50, "Account code must be 50 characters or fewer")
    .regex(
      /^[A-Za-z0-9._-]+$/,
      "Account code can only contain letters, numbers, hyphens, and periods",
    ),
  accountName: z
    .string()
    .trim()
    .min(1, "Account name is required")
    .max(150, "Account name must be 150 characters or fewer"),
  accountType: z.enum(FINANCE_ACCOUNT_TYPES),
  parentAccountId: z.number().int().positive().nullable().optional(),
  currency: z
    .string()
    .trim()
    .length(3, "Currency code must be exactly 3 uppercase letters")
    .default("INR"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer")
    .nullable()
    .optional(),
});

export type CreateFinanceAccountFormValues = z.infer<
  typeof createFinanceAccountSchema
>;

export const updateFinanceAccountSchema = z.object({
  accountCode: z
    .string()
    .trim()
    .min(1, "Account code is required")
    .max(50, "Account code must be 50 characters or fewer")
    .regex(
      /^[A-Za-z0-9._-]+$/,
      "Account code can only contain letters, numbers, hyphens, and periods",
    )
    .optional(),
  accountName: z
    .string()
    .trim()
    .min(1, "Account name is required")
    .max(150, "Account name must be 150 characters or fewer")
    .optional(),
  parentAccountId: z.number().int().positive().nullable().optional(),
  currency: z
    .string()
    .trim()
    .length(3, "Currency code must be exactly 3 uppercase letters")
    .optional(),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer")
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
});

export type UpdateFinanceAccountFormValues = z.infer<
  typeof updateFinanceAccountSchema
>;
