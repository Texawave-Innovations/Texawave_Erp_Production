import { FINANCE_JOURNAL_ENTRY_TYPES } from "@texawave-erp/api-types";
import { z } from "zod";

export const createJournalLineSchema = z.object({
  accountId: z.number().int().positive("Please select an account"),
  debit: z.number().min(0, "Debit cannot be negative").default(0),
  credit: z.number().min(0, "Credit cannot be negative").default(0),
  description: z
    .string()
    .trim()
    .max(255, "Line memo must be 255 characters or fewer")
    .nullable()
    .optional(),
});

export type CreateJournalLineFormValues = z.infer<
  typeof createJournalLineSchema
>;

export const createJournalEntrySchema = z
  .object({
    entryNumber: z
      .string()
      .trim()
      .max(50, "Entry number must be 50 characters or fewer")
      .optional(),
    entryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
    entryType: z.enum(FINANCE_JOURNAL_ENTRY_TYPES).default("MANUAL"),
    narration: z
      .string()
      .trim()
      .min(1, "Voucher narration is required")
      .max(500, "Narration must be 500 characters or fewer"),
    referenceNumber: z
      .string()
      .trim()
      .max(100, "Reference must be 100 characters or fewer")
      .nullable()
      .optional(),
    lines: z
      .array(createJournalLineSchema)
      .min(2, "A journal voucher must have at least 2 lines for double-entry"),
  })
  .refine(
    (data) => {
      let totalDebit = 0;
      let totalCredit = 0;
      for (const line of data.lines) {
        totalDebit += Number(line.debit || 0);
        totalCredit += Number(line.credit || 0);
      }
      totalDebit = Math.round(totalDebit * 100) / 100;
      totalCredit = Math.round(totalCredit * 100) / 100;
      return totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.005;
    },
    {
      message:
        "Total Debits must equal Total Credits, and must be greater than zero",
      path: ["lines"],
    },
  );

export type CreateJournalEntryFormValues = z.infer<
  typeof createJournalEntrySchema
>;

export const reverseJournalEntrySchema = z.object({
  reversalDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .optional(),
  reason: z
    .string()
    .trim()
    .min(1, "Please provide a reason for the reversal")
    .max(500, "Reason must be 500 characters or fewer"),
});

export type ReverseJournalEntryFormValues = z.infer<
  typeof reverseJournalEntrySchema
>;
