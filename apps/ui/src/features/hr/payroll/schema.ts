import { z } from "zod";

/** Mirrors CreatePayrollPeriodDto (apps/api/.../periods/dto/payroll-period.dto.ts). */
export const createPeriodSchema = z
  .object({
    year: z.coerce
      .number()
      .int("Enter a whole year")
      .min(2000, "Year must be 2000 or later")
      .max(2100, "Year must be 2100 or earlier"),
    month: z.coerce
      .number()
      .int()
      .min(1, "Choose a month")
      .max(12, "Choose a month"),
    periodStart: z.string().optional(),
    periodEnd: z.string().optional(),
  })
  .refine(
    (v) => !v.periodStart || !v.periodEnd || v.periodEnd >= v.periodStart,
    { message: "End date cannot be before start date", path: ["periodEnd"] },
  );
export type CreatePeriodValues = z.infer<typeof createPeriodSchema>;

/** Optional free-text note on a run or approval. */
export const runNotesSchema = z.object({
  notes: z.string().trim().max(500, "Keep the note under 500 characters"),
});
