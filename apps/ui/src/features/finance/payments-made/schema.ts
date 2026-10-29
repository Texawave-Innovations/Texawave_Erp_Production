import { FINANCE_PAYMENT_MADE_STATUSES } from "@texawave-erp/api-types";
import { z } from "zod";

export const createPaymentMadeSchema = z.object({
  paymentNumber: z
    .string()
    .trim()
    .max(50, "Payment number must be 50 characters or fewer")
    .optional(),
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Payment date must be in YYYY-MM-DD format")
    .refine(
      (val) => val <= new Date().toISOString().slice(0, 10),
      "Payment date cannot be in the future",
    ),
  vendorName: z
    .string()
    .trim()
    .min(1, "Vendor / Supplier name is required")
    .max(150, "Vendor name must be 150 characters or fewer"),
  amount: z
    .number()
    .positive("Disbursement amount must be greater than zero")
    .min(0.01, "Disbursement amount must be at least 0.01"),
  paymentModeId: z.number().int().positive("Please select a payment mode"),
  bankAccountId: z.number().int().positive().optional().nullable(),
  referenceNumber: z
    .string()
    .trim()
    .max(100, "Reference must be 100 characters or fewer")
    .optional()
    .nullable(),
  billReference: z
    .string()
    .trim()
    .max(100, "Purchase bill or PO reference must be 100 characters or fewer")
    .optional()
    .nullable(),
  scmSupplierPaymentId: z.number().int().positive().optional().nullable(),
  notes: z
    .string()
    .trim()
    .max(1000, "Notes must be 1000 characters or fewer")
    .optional()
    .nullable(),
  status: z.enum(FINANCE_PAYMENT_MADE_STATUSES).default("CONFIRMED"),
});

export type CreatePaymentMadeFormValues = z.infer<
  typeof createPaymentMadeSchema
>;

export const updatePaymentMadeSchema = z.object({
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Payment date must be in YYYY-MM-DD format")
    .refine(
      (val) => val <= new Date().toISOString().slice(0, 10),
      "Payment date cannot be in the future",
    )
    .optional(),
  vendorName: z
    .string()
    .trim()
    .min(1, "Vendor / Supplier name is required")
    .max(150, "Vendor name must be 150 characters or fewer")
    .optional(),
  referenceNumber: z
    .string()
    .trim()
    .max(100, "Reference must be 100 characters or fewer")
    .optional()
    .nullable(),
  billReference: z
    .string()
    .trim()
    .max(100, "Purchase bill or PO reference must be 100 characters or fewer")
    .optional()
    .nullable(),
  notes: z
    .string()
    .trim()
    .max(1000, "Notes must be 1000 characters or fewer")
    .optional()
    .nullable(),
});

export type UpdatePaymentMadeFormValues = z.infer<
  typeof updatePaymentMadeSchema
>;
