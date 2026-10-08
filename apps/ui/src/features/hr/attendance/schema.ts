import { z } from "zod";
import type { CorrectionType } from "./types";

/**
 * Client-side UX validation only. Mirrors
 * apps/api/src/modules/hr/attendance/dto/attendance.dto.ts so the form fails
 * the way the API would, before a round trip. The backend remains
 * authoritative.
 */
export const editableSessionSchema = z.object({
  checkInAt: z.string().min(1, "Check-in time is required"),
  checkOutAt: z.string(),
});

export type EditableSession = z.infer<typeof editableSessionSchema>;

export const manualEditSchema = z.object({
  status: z.union([
    z.literal("PRESENT"),
    z.literal("ABSENT"),
    z.literal("HALF_DAY"),
    z.literal(""),
  ]),
  sessions: z
    .array(editableSessionSchema)
    .max(20, "At most 20 sessions per day"),
});

export type ManualEditValues = z.infer<typeof manualEditSchema>;

/** Mirrors ALLOWED_TIMES in
 * apps/api/src/modules/hr/attendance/services/attendance-correction-planner.ts:
 * which punch each correction type may request, and (from
 * attendance-corrections.service.ts `validateSubmission`) which of those is
 * mandatory. */
export const CORRECTION_FIELD_RULES: Record<
  CorrectionType,
  { in: boolean; out: boolean; requiresIn?: boolean; requiresOut?: boolean }
> = {
  MISSED_CHECK_IN: { in: true, out: true, requiresIn: true },
  MISSED_CHECK_OUT: { in: false, out: true, requiresOut: true },
  INCORRECT_TIME: { in: true, out: true },
  LATE_ARRIVAL: { in: true, out: false, requiresIn: true },
  EARLY_DEPARTURE: { in: false, out: true, requiresOut: true },
};

const DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

export const submitCorrectionSchema = z
  .object({
    attendanceDate: z
      .string()
      .min(1, "Date is required")
      .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), {
        message: "Use a valid date",
      }),
    correctionType: z.enum([
      "MISSED_CHECK_IN",
      "MISSED_CHECK_OUT",
      "INCORRECT_TIME",
      "LATE_ARRIVAL",
      "EARLY_DEPARTURE",
    ]),
    requestedCheckInAt: z.string(),
    requestedCheckOutAt: z.string(),
    reason: z
      .string()
      .trim()
      .min(3, "Explain the correction in at least 3 characters")
      .max(500, "Reason must be 500 characters or fewer"),
  })
  .superRefine((values, ctx) => {
    const rules = CORRECTION_FIELD_RULES[values.correctionType];
    const hasIn = values.requestedCheckInAt !== "";
    const hasOut = values.requestedCheckOutAt !== "";
    if (hasIn && !DATETIME_LOCAL.test(values.requestedCheckInAt)) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedCheckInAt"],
        message: "Use a valid date and time",
      });
    }
    if (hasOut && !DATETIME_LOCAL.test(values.requestedCheckOutAt)) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedCheckOutAt"],
        message: "Use a valid date and time",
      });
    }
    if (rules.requiresIn && !hasIn) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedCheckInAt"],
        message: "This correction type needs the corrected check-in",
      });
    }
    if (rules.requiresOut && !hasOut) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedCheckOutAt"],
        message: "This correction type needs the corrected check-out",
      });
    }
    if (!rules.requiresIn && !rules.requiresOut && !hasIn && !hasOut) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedCheckInAt"],
        message: "A correction must request at least one time",
      });
    }
    if (
      hasIn &&
      hasOut &&
      DATETIME_LOCAL.test(values.requestedCheckInAt) &&
      DATETIME_LOCAL.test(values.requestedCheckOutAt) &&
      new Date(values.requestedCheckOutAt) <=
        new Date(values.requestedCheckInAt)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedCheckOutAt"],
        message: "The requested check-out must be after the check-in",
      });
    }
  });

export type SubmitCorrectionValues = z.infer<typeof submitCorrectionSchema>;

export const EMPTY_SUBMIT_CORRECTION_FORM = {
  attendanceDate: "",
  correctionType: "MISSED_CHECK_IN" as CorrectionType,
  requestedCheckInAt: "",
  requestedCheckOutAt: "",
  reason: "",
};

export const approveCorrectionSchema = z.object({
  note: z
    .string()
    .trim()
    .refine((v) => v === "" || (v.length >= 3 && v.length <= 500), {
      message: "Note must be 3–500 characters, or left empty",
    }),
});

export const rejectCorrectionSchema = z.object({
  note: z
    .string()
    .trim()
    .min(3, "A rejection needs a note (3–500 characters)")
    .max(500, "Note must be 500 characters or fewer"),
});
