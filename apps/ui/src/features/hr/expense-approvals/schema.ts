import { z } from "zod";
import { EXPENSE_TYPES } from "./types";

/**
 * Client-side UX validation only. Mirrors
 * apps/api/src/modules/hr/expense-claims/dto/expense-claim.dto.ts
 * (CreateExpenseClaimDto). The backend remains authoritative — this only
 * catches obviously malformed input before a round trip.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const todayStr = () => new Intl.DateTimeFormat("en-CA").format(new Date());

export const submitExpenseClaimSchema = z.object({
  expenseType: z.enum(EXPENSE_TYPES, { message: "Select an expense type" }),
  amount: z
    .number({ message: "Enter an amount" })
    .min(0.01, "Amount must be greater than 0")
    .max(9999999999.99, "Amount is too large")
    .refine((v) => Math.round(v * 100) === v * 100, {
      message: "At most 2 decimal places",
    }),
  expenseDate: z
    .string()
    .min(1, "Expense date is required")
    .refine((v) => ISO_DATE.test(v), { message: "Use a valid date" })
    .refine((v) => v <= todayStr(), {
      message: "Date cannot be in the future",
    }),
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(300, "Description must be at most 300 characters"),
  receiptRef: z
    .string()
    .trim()
    .max(100, "Receipt reference must be at most 100 characters")
    .optional()
    .or(z.literal("")),
});

export type SubmitExpenseClaimValues = z.infer<typeof submitExpenseClaimSchema>;

export const EMPTY_SUBMIT_FORM = {
  expenseType: "" as unknown as (typeof EXPENSE_TYPES)[number],
  amount: 0,
  expenseDate: "",
  description: "",
  receiptRef: "",
};

export const decideExpenseClaimSchema = z.object({
  note: z
    .string()
    .trim()
    .refine((v) => v === "" || (v.length >= 1 && v.length <= 500), {
      message: "Note must be at most 500 characters",
    }),
});
