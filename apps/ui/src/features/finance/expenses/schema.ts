import { FINANCE_EXPENSE_STATUSES } from "@texawave-erp/api-types";
import { z } from "zod";

export const createExpenseSchema = z.object({
  expenseNumber: z
    .string()
    .trim()
    .max(50, "Expense number must be 50 characters or fewer")
    .optional(),
  expenseTypeId: z.number().int().positive("Please select an expense category"),
  expenseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expense date must be in YYYY-MM-DD format")
    .refine(
      (val) => val <= new Date().toISOString().slice(0, 10),
      "Expense date cannot be in the future",
    ),
  amount: z
    .number()
    .positive("Expense gross amount must be greater than zero")
    .min(0.01, "Amount must be at least 0.01"),
  taxAmount: z
    .number()
    .min(0, "Tax amount cannot be negative")
    .default(0)
    .optional(),
  paymentModeId: z.number().int().positive().optional().nullable(),
  bankAccountId: z.number().int().positive().optional().nullable(),
  glAccountId: z.number().int().positive().optional().nullable(),
  vendorName: z
    .string()
    .trim()
    .max(255, "Vendor name must be 255 characters or fewer")
    .optional()
    .nullable(),
  notes: z
    .string()
    .trim()
    .max(1000, "Notes must be 1000 characters or fewer")
    .optional()
    .nullable(),
  receiptUrl: z
    .string()
    .trim()
    .max(500, "Receipt URL must be 500 characters or fewer")
    .optional()
    .nullable(),
  status: z.enum(FINANCE_EXPENSE_STATUSES).default("DRAFT"),
});

export type CreateExpenseFormValues = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = z.object({
  expenseTypeId: z
    .number()
    .int()
    .positive("Please select an expense category")
    .optional(),
  expenseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Expense date must be in YYYY-MM-DD format")
    .refine(
      (val) => val <= new Date().toISOString().slice(0, 10),
      "Expense date cannot be in the future",
    )
    .optional(),
  amount: z
    .number()
    .positive("Expense gross amount must be greater than zero")
    .min(0.01, "Amount must be at least 0.01")
    .optional(),
  taxAmount: z.number().min(0, "Tax amount cannot be negative").optional(),
  paymentModeId: z.number().int().positive().optional().nullable(),
  bankAccountId: z.number().int().positive().optional().nullable(),
  glAccountId: z.number().int().positive().optional().nullable(),
  vendorName: z
    .string()
    .trim()
    .max(255, "Vendor name must be 255 characters or fewer")
    .optional()
    .nullable(),
  notes: z
    .string()
    .trim()
    .max(1000, "Notes must be 1000 characters or fewer")
    .optional()
    .nullable(),
  receiptUrl: z
    .string()
    .trim()
    .max(500, "Receipt URL must be 500 characters or fewer")
    .optional()
    .nullable(),
});

export type UpdateExpenseFormValues = z.infer<typeof updateExpenseSchema>;

export const payExpenseSchema = z.object({
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Payment date must be in YYYY-MM-DD format")
    .refine(
      (val) => val <= new Date().toISOString().slice(0, 10),
      "Payment date cannot be in the future",
    )
    .optional(),
  paymentModeId: z.number().int().positive().optional().nullable(),
  bankAccountId: z.number().int().positive().optional().nullable(),
  notes: z
    .string()
    .trim()
    .max(1000, "Payment notes must be 1000 characters or fewer")
    .optional()
    .nullable(),
});

export type PayExpenseFormValues = z.infer<typeof payExpenseSchema>;

export const createExpenseFromClaimSchema = z.object({
  glAccountId: z.number().int().positive().optional().nullable(),
  paymentModeId: z.number().int().positive().optional().nullable(),
  bankAccountId: z.number().int().positive().optional().nullable(),
  notes: z
    .string()
    .trim()
    .max(1000, "Notes must be 1000 characters or fewer")
    .optional()
    .nullable(),
});

export type CreateExpenseFromClaimFormValues = z.infer<
  typeof createExpenseFromClaimSchema
>;
