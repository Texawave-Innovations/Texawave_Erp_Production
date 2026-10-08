import { z } from "zod";
import { SETTLEMENT_STATUSES } from "./types";

/**
 * Client-side UX validation only. Mirrors
 * apps/api/src/modules/hr/exit-requests/dto/exit-request.dto.ts
 * (CreateExitRequestDto). The backend remains authoritative — this only
 * catches obviously malformed input before a round trip.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const todayStr = () => new Intl.DateTimeFormat("en-CA").format(new Date());

export const submitExitRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Reason is required")
    .max(2000, "Reason must be at most 2000 characters"),
  preferredLastWorkingDate: z
    .string()
    .min(1, "Preferred last working date is required")
    .refine((v) => ISO_DATE.test(v), { message: "Use a valid date" })
    .refine((v) => v >= todayStr(), {
      message: "Date cannot be in the past",
    }),
  noticePeriodDays: z
    .number({ message: "Enter a number of days" })
    .int("Must be a whole number")
    .min(0, "Cannot be negative"),
  additionalNotes: z
    .string()
    .trim()
    .max(2000, "Additional notes must be at most 2000 characters")
    .optional()
    .or(z.literal("")),
});

export type SubmitExitRequestValues = z.infer<typeof submitExitRequestSchema>;

export const EMPTY_SUBMIT_FORM = {
  reason: "",
  preferredLastWorkingDate: "",
  noticePeriodDays: 30,
  additionalNotes: "",
};

export const decideExitRequestSchema = z.object({
  confirmedLastWorkingDate: z
    .string()
    .refine((v) => v === "" || ISO_DATE.test(v), {
      message: "Use a valid date",
    }),
  settlementStatus: z.enum([...SETTLEMENT_STATUSES, ""] as const),
  hrNote: z
    .string()
    .trim()
    .refine((v) => v.length <= 2000, {
      message: "Note must be at most 2000 characters",
    }),
});
