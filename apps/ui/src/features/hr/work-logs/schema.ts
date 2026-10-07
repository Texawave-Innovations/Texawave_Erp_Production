import { z } from "zod";

/**
 * Client-side UX validation only. Mirrors
 * apps/api/src/modules/hr/work-logs/dto/work-log.dto.ts so the form fails the
 * way the API would, before a round trip. The backend remains authoritative.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const createWorkLogSchema = z.object({
  workDate: z
    .string()
    .min(1, "Date is required")
    .refine((v) => ISO_DATE.test(v), { message: "Use a valid date" }),
  hoursWorked: z
    .string()
    .min(1, "Hours worked is required")
    .refine(
      (v) => {
        const n = Number(v);
        return Number.isFinite(n) && n >= 0.01 && n <= 24;
      },
      { message: "Enter hours between 0.01 and 24" },
    ),
  taskDescription: z
    .string()
    .trim()
    .min(3, "Describe the task in at least 3 characters")
    .max(500, "Task description must be 500 characters or fewer"),
});

export type CreateWorkLogValues = z.infer<typeof createWorkLogSchema>;

export const EMPTY_CREATE_FORM: CreateWorkLogValues = {
  workDate: "",
  hoursWorked: "",
  taskDescription: "",
};

export const decideWorkLogSchema = z.object({
  note: z
    .string()
    .trim()
    .refine((v) => v === "" || (v.length >= 3 && v.length <= 500), {
      message: "Note must be 3–500 characters, or left empty",
    }),
});

export type DecideWorkLogValues = z.infer<typeof decideWorkLogSchema>;
