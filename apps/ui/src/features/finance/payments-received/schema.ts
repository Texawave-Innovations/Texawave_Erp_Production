import { FINANCE_PAYMENT_RECEIVED_STATUSES } from "@texawave-erp/api-types";
import { z } from "zod";

export const createPaymentAllocationSchema = z.object({
  invoiceReference: z
    .string()
    .trim()
    .min(1, "Invoice reference is required")
    .max(100, "Invoice reference must be 100 characters or fewer"),
  allocatedAmount: z
    .number()
    .positive("Allocated amount must be greater than zero"),
  notes: z
    .string()
    .trim()
    .max(1000, "Notes must be 1000 characters or fewer")
    .optional()
    .nullable(),
});

export type CreatePaymentAllocationFormValues = z.infer<
  typeof createPaymentAllocationSchema
>;

export const createPaymentReceivedSchema = z
  .object({
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
    customerId: z.number().int().positive().optional().nullable(),
    customerName: z
      .string()
      .trim()
      .min(1, "Customer name is required")
      .max(200, "Customer name must be 200 characters or fewer"),
    amount: z.number().positive("Amount received must be greater than zero"),
    paymentModeId: z.number().int().positive("Please select a payment mode"),
    bankAccountId: z.number().int().positive().optional().nullable(),
    referenceNumber: z
      .string()
      .trim()
      .max(100, "Reference must be 100 characters or fewer")
      .optional()
      .nullable(),
    invoiceReference: z
      .string()
      .trim()
      .max(100, "Invoice reference must be 100 characters or fewer")
      .optional()
      .nullable(),
    notes: z
      .string()
      .trim()
      .max(1000, "Notes must be 1000 characters or fewer")
      .optional()
      .nullable(),
    status: z.enum(FINANCE_PAYMENT_RECEIVED_STATUSES).default("CONFIRMED"),
    allocations: z.array(createPaymentAllocationSchema).optional().default([]),
  })
  .refine(
    (data) => {
      if (!data.allocations || data.allocations.length === 0) return true;
      const totalAllocated = data.allocations.reduce(
        (sum, item) => sum + Number(item.allocatedAmount || 0),
        0,
      );
      // Allocation sum cannot exceed amount received (round to 2 decimals)
      return Math.round(totalAllocated * 100) <= Math.round(data.amount * 100);
    },
    {
      message: "Total allocated amount cannot exceed total amount received",
      path: ["allocations"],
    },
  );

export type CreatePaymentReceivedFormValues = z.infer<
  typeof createPaymentReceivedSchema
>;
