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
