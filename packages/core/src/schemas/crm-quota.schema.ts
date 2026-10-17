import { z } from "zod";

/** Mirrors apps/api/src/modules/crm/quotas/dto/quota.dto.ts and legacy
 * Quotas.tsx `validateForm` (period-key format, amount > 0). */
const optionalStr = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(""));

export const createQuotaSchema = z
  .object({
    repName: z.string().trim().min(1, "Rep is required."),
    team: optionalStr(150),
    managerName: optionalStr(150),
    targetOwner: optionalStr(150),
    period: z.enum(["monthly", "quarterly"]),
    periodKey: z.string().trim().min(1, "Period is required."),
    startDate: optionalStr(40),
    endDate: optionalStr(40),
    targetAmount: z
      .number({ error: "Target Amount must be greater than 0." })
      .gt(0, "Target Amount must be greater than 0."),
    metric: z.enum(["revenue", "closedWonValue", "dealsWon"]),
    currency: optionalStr(10),
    notes: z.string().max(2000).optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    const ok =
      v.period === "monthly"
        ? /^\d{4}-(0?[1-9]|1[0-2])$/.test(v.periodKey)
        : /^\d{4}-Q[1-4]$/.test(v.periodKey);
    if (!ok) {
      ctx.addIssue({
        code: "custom",
        path: ["periodKey"],
        message:
          v.period === "monthly"
            ? "Period Key must be in YYYY-MM format."
            : "Period Key must be in YYYY-Q# format.",
      });
    }
  });

export type CreateQuotaFormValues = z.infer<typeof createQuotaSchema>;
