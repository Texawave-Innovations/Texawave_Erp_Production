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

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v));
const optionalDate = z.string().transform((v) => (v === "" ? undefined : v));

/** Mirrors UpdateEmployeePfProfileDto. UAN format is a UI rule
 * (Docs/PAYROLL_AND_COMPLIANCE.md §5.3); the API accepts any string. */
export const pfProfileSchema = z
  .object({
    pfApplicable: z.boolean(),
    uan: optionalText.pipe(
      z
        .string()
        .regex(/^[0-9]{12}$/, "UAN is 12 digits")
        .optional(),
    ),
    pfNumber: optionalText.pipe(z.string().max(30).optional()),
    effectiveFrom: optionalDate,
    effectiveTo: optionalDate,
  })
  .refine(
    (v) =>
      !v.effectiveFrom || !v.effectiveTo || v.effectiveTo >= v.effectiveFrom,
    { message: "End date cannot be before start date", path: ["effectiveTo"] },
  );

/** Mirrors UpdateEmployeeEsiProfileDto. The 10- or 17-digit IP number is a
 * UI rule only. */
export const esiProfileSchema = z
  .object({
    esiApplicable: z.boolean(),
    insuranceNumber: optionalText.pipe(
      z
        .string()
        .regex(/^([0-9]{10}|[0-9]{17})$/, "ESI number is 10 or 17 digits")
        .optional(),
    ),
    effectiveFrom: optionalDate,
    effectiveTo: optionalDate,
  })
  .refine(
    (v) =>
      !v.effectiveFrom || !v.effectiveTo || v.effectiveTo >= v.effectiveFrom,
    { message: "End date cannot be before start date", path: ["effectiveTo"] },
  );

/** Mirrors CreateLoanDto plus the API's schedule rule (§3.4): EMI × months
 * must cover the principal without over-covering it by a full EMI. */
export const createLoanSchema = z
  .object({
    employeeId: z.number({ message: "Choose an employee" }).int().positive(),
    principalAmount: z.coerce
      .number({ message: "Enter an amount" })
      .min(1, "Must be at least ₹1"),
    emiAmount: z.coerce
      .number({ message: "Enter an amount" })
      .min(1, "Must be at least ₹1"),
    emiMonths: z.coerce
      .number({ message: "Enter the number of months" })
      .int("Whole months only")
      .min(1, "At least 1 month"),
    disbursedDate: z.string().min(1, "Choose the disbursement date"),
    reason: optionalText.pipe(z.string().max(500).optional()),
  })
  .refine((v) => v.emiAmount * v.emiMonths >= v.principalAmount, {
    message: "EMI × months must cover the principal",
    path: ["emiAmount"],
  })
  .refine((v) => v.emiAmount * (v.emiMonths - 1) < v.principalAmount, {
    message: "Too many months: the last installment would be empty",
    path: ["emiMonths"],
  });

/** Mirrors CreateLoanSkipRequestDto. */
export const loanSkipSchema = z.object({
  payrollPeriodId: z.number({ message: "Choose a payroll period" }).int(),
  reason: z.string().trim().min(3, "Give a reason (at least 3 characters)"),
});

/** Mirrors CreateBonusDto (the fields this form offers). */
export const createBonusSchema = z.object({
  employeeId: z.number({ message: "Choose an employee" }).int().positive(),
  bonusType: z.enum(
    ["FESTIVAL", "PERFORMANCE", "STATUTORY", "ANNUAL", "SPOT"],
    { message: "Choose a bonus type" },
  ),
  amount: z.coerce
    .number({ message: "Enter an amount" })
    .min(1, "Must be at least ₹1"),
  payrollPeriodId: z.number().int().optional(),
  reason: optionalText.pipe(z.string().max(500).optional()),
});

/** Field → first message, for FormField `error` props. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
