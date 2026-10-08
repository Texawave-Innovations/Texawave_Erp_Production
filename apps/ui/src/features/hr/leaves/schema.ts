import { z } from "zod";
import { DAY_PORTIONS } from "./types";

/**
 * Client-side UX validation only. Mirrors
 * apps/api/src/modules/hr/leave-requests/dto/leave-request.dto.ts (CreateLeaveRequestDto).
 * The backend remains authoritative for working-day, overlap, balance and
 * year-boundary rules (Docs/HR_LEAVE.md §3-5) — this only catches obviously
 * malformed input before a round trip.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const requestLeaveSchema = z
  .object({
    leaveTypeId: z.number({ message: "Select a leave type" }).int().min(1),
    startDate: z
      .string()
      .min(1, "Start date is required")
      .refine((v) => ISO_DATE.test(v), { message: "Use a valid date" }),
    endDate: z
      .string()
      .min(1, "End date is required")
      .refine((v) => ISO_DATE.test(v), { message: "Use a valid date" }),
    dayPortion: z.enum(DAY_PORTIONS).default("FULL"),
    reason: z
      .string()
      .trim()
      .min(3, "Reason must be 3–500 characters")
      .max(500, "Reason must be 3–500 characters"),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "End date cannot be before the start date",
    path: ["endDate"],
  })
  .refine((v) => v.dayPortion === "FULL" || v.startDate === v.endDate, {
    message: "A half-day request must use the same start and end date",
    path: ["dayPortion"],
  });

export type RequestLeaveValues = z.infer<typeof requestLeaveSchema>;

export const EMPTY_REQUEST_FORM = {
  leaveTypeId: 0,
  startDate: "",
  endDate: "",
  dayPortion: "FULL" as const,
  reason: "",
};

export const cancelLeaveSchema = z.object({
  note: z
    .string()
    .trim()
    .refine((v) => v === "" || (v.length >= 3 && v.length <= 500), {
      message: "Note must be 3–500 characters, or left empty",
    }),
});

export const rejectLeaveSchema = z.object({
  note: z
    .string()
    .trim()
    .min(3, "A rejection reason is required (3–500 characters)")
    .max(500, "A rejection reason is required (3–500 characters)"),
});

export const approveLeaveSchema = z.object({
  note: z
    .string()
    .trim()
    .refine((v) => v === "" || (v.length >= 3 && v.length <= 500), {
      message: "Note must be 3–500 characters, or left empty",
    }),
});

/**
 * Mirrors apps/api/.../leave-types/dto/create-leave-type.dto.ts. `code` is
 * immutable once created (omitted entirely on edit, like designations/code).
 */
const CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,29}$/;

export const createLeaveTypeSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Code must be 2–30 characters")
    .max(30, "Code must be 2–30 characters")
    .refine((v) => CODE_PATTERN.test(v), {
      message:
        "Upper-case letters, digits or underscore; must start with a letter",
    }),
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(500).optional(),
  isPaid: z.boolean(),
  annualEntitlement: z.number().min(0).max(366),
  carryForwardLimit: z.number().min(0).max(366),
});
export type CreateLeaveTypeFormValues = z.infer<typeof createLeaveTypeSchema>;

export const updateLeaveTypeSchema = createLeaveTypeSchema.omit({
  code: true,
});
export type UpdateLeaveTypeFormValues = z.infer<typeof updateLeaveTypeSchema>;

export const EMPTY_LEAVE_TYPE_FORM: CreateLeaveTypeFormValues = {
  code: "",
  name: "",
  description: "",
  isPaid: true,
  annualEntitlement: 0,
  carryForwardLimit: 0,
};

/** Mirrors SetLeaveEntitlementDto. `annualEntitlement: null` clears the
 * override so the leave type default applies again. */
export const setEntitlementSchema = z.object({
  employeeId: z.number().int().min(1, "Select a valid employee"),
  year: z.number().int().min(2000).max(2200),
  annualEntitlement: z.number().min(0).max(366).nullable(),
});
export type SetEntitlementFormValues = z.infer<typeof setEntitlementSchema>;
