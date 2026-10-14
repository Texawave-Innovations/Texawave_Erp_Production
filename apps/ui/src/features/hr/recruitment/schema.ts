import { z } from "zod";
import { INTERVIEW_MODES } from "./types";

// Frontend validation mirrors the backend DTO limits so the user sees the
// problem before submitting. The backend stays authoritative: its 400
// messages are shown as-is when they still come back.

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

function text(label: string, min: number, max: number) {
  return z
    .string()
    .trim()
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);
}

function optionalText(label: string, min: number, max: number) {
  return z
    .string()
    .trim()
    .refine((v) => v === "" || v.length >= min, {
      message: `${label} must be at least ${min} characters`,
    })
    .refine((v) => v.length <= max, {
      message: `${label} must be at most ${max} characters`,
    });
}

const money = z
  .string()
  .trim()
  .refine((v) => v === "" || MONEY_PATTERN.test(v), {
    message: "Enter an amount with at most 2 decimals",
  });

export const interviewFormSchema = z.object({
  candidateName: text("Candidate name", 2, 120),
  roleTitle: text("Role", 2, 120),
  interviewerName: text("Interviewer name", 2, 120),
  interviewDate: z.string().min(1, "Date is required"),
  interviewTime: z.string().regex(TIME_PATTERN, "Time is required (HH:MM)"),
  mode: z.enum(INTERVIEW_MODES),
  notes: optionalText("Notes", 0, 2000),
});

export const offerFormSchema = z.object({
  candidateName: text("Candidate name", 2, 120),
  role: text("Role / designation", 2, 120),
  location: text("Location", 2, 120),
  reportingManager: optionalText("Reporting manager", 2, 120),
  offerDate: z.string().min(1, "Offer date is required"),
  joiningDate: z.string().min(1, "Joining date is required"),
  offerValidityDate: z.string(),
  basic: money,
  da: money,
  hra: money,
  ca: money,
  workScheduleMonFri: text("Mon–Fri schedule", 1, 60),
  workScheduleSat: text("Saturday schedule", 1, 60),
  workScheduleSun: text("Sunday schedule", 1, 60),
  signatoryName: text("Signatory name", 2, 120),
  signatoryDesignation: text("Signatory designation", 2, 120),
  companyEmail: z.string().trim().email("Enter a valid company e-mail"),
  companyPhone: text("Company phone", 5, 30),
  companyWebsite: text("Company website", 3, 120),
  companyAddress: text("Company address", 5, 300),
});

export const revisionFormSchema = z.object({
  employeeId: z.number().int().positive("Select an employee"),
  designation: text("Designation", 2, 120),
  location: text("Location", 2, 120),
  letterDate: z.string(),
  effectiveDate: z.string().min(1, "Effective date is required"),
  basic: money,
  da: money,
  hra: money,
  ca: money,
  signatoryName: text("Signatory name", 2, 120),
  signatoryDesignation: text("Signatory designation", 2, 120),
});

/** Same as a revision letter, but the designation is a master-list id held as
 * the `<select>` value string ("" = nothing picked). */
export const promotionFormSchema = revisionFormSchema
  .omit({ designation: true })
  .extend({
    designationId: z.string().regex(/^[1-9]\d*$/, "Select a designation"),
  });

/** Code for a designation added from the promotion form: upper-case letters,
 * digits and `_`, 2–30 characters, as the master-data DTO requires. */
export const designationCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_]{2,30}$/, "2–30 letters, digits or _");

export type InterviewFormValues = z.infer<typeof interviewFormSchema>;
export type PromotionFormValues = z.infer<typeof promotionFormSchema>;
export type OfferFormValues = z.infer<typeof offerFormSchema>;
export type RevisionFormValues = z.infer<typeof revisionFormSchema>;

/** Empty money input means "not given"; the backend then applies its default. */
export function toAmount(value: string): number | undefined {
  return value.trim() === "" ? undefined : Number(value);
}

/** Collects zod issues into one message per field, for inline display. */
export function issuesByField(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}
