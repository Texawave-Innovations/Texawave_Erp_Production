import { z } from "zod";
import { ALLOWED_TIMES, CORRECTION_TYPES } from "./types";

/**
 * Client-side UX validation only. Mirrors
 * apps/api/src/modules/hr/attendance/dto/attendance-correction.dto.ts and
 * validateSubmission() in attendance-corrections.service.ts so the form
 * fails the way the API would, before a round trip. The backend remains
 * authoritative.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const submitCorrectionSchema = z.object({
  attendanceDate: z
    .string()
    .min(1, "Date is required")
    .refine((v) => ISO_DATE.test(v), { message: "Use a valid date" })
    .refine((v) => v <= new Intl.DateTimeFormat("en-CA").format(new Date()), {
      message: "A correction cannot be requested for a future date",
    }),
  correctionType: z.enum(CORRECTION_TYPES, {
    message: "Select a correction type",
  }),
  requestedCheckInAt: z.string().optional(),
  requestedCheckOutAt: z.string().optional(),
  reason: z
    .string()
    .trim()
    .min(3, "Reason must be 3–500 characters")
    .max(500, "Reason must be 3–500 characters"),
});

export type SubmitCorrectionValues = z.infer<typeof submitCorrectionSchema>;

export const EMPTY_SUBMIT_FORM: SubmitCorrectionValues = {
  attendanceDate: "",
  correctionType: "MISSED_CHECK_IN",
  requestedCheckInAt: "",
  requestedCheckOutAt: "",
  reason: "",
};

/** Cross-field rules the single-field zod shape above can't express: which
 * punch(es) a given correction type requires/allows. Called explicitly by
 * the dialog after the base schema passes, mirroring ALLOWED_TIMES. */
export function validateCorrectionTimes(
  values: SubmitCorrectionValues,
): string | null {
  const allowed = ALLOWED_TIMES[values.correctionType];
  const hasIn = Boolean(values.requestedCheckInAt);
  const hasOut = Boolean(values.requestedCheckOutAt);
  if (!hasIn && !hasOut) return "Enter at least one corrected time";
  if (hasIn && !allowed.in)
    return "This correction type does not change check-in";
  if (hasOut && !allowed.out)
    return "This correction type does not change check-out";
  if (values.correctionType === "MISSED_CHECK_IN" && !hasIn)
    return "A missed check-in needs the check-in time";
  if (values.correctionType === "MISSED_CHECK_OUT" && !hasOut)
    return "A missed check-out needs the check-out time";
  if (values.correctionType === "LATE_ARRIVAL" && !hasIn)
    return "A late arrival needs the corrected check-in";
  if (values.correctionType === "EARLY_DEPARTURE" && !hasOut)
    return "An early departure needs the corrected check-out";
  if (
    hasIn &&
    hasOut &&
    new Date(values.requestedCheckOutAt!) <=
      new Date(values.requestedCheckInAt!)
  )
    return "The requested check-out must be after the check-in";
  return null;
}

export const decideCorrectionSchema = z.object({
  note: z
    .string()
    .trim()
    .refine((v) => v === "" || (v.length >= 3 && v.length <= 500), {
      message: "Note must be 3–500 characters, or left empty",
    }),
});

export type DecideCorrectionValues = z.infer<typeof decideCorrectionSchema>;

export const rejectCorrectionSchema = z.object({
  note: z
    .string()
    .trim()
    .min(3, "A rejection note is required (3–500 characters)")
    .max(500, "A rejection note is required (3–500 characters)"),
});
