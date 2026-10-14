import { z } from "zod";
import { TASK_PRIORITIES } from "./types";

/**
 * Client-side UX validation only. Mirrors
 * apps/api/src/modules/hr/tasks/dto/task.dto.ts so the form fails the way
 * the API would, before a round trip. The backend remains authoritative.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(80, "Title must be 80 characters or fewer"),
  description: z
    .string()
    .trim()
    .refine((v) => v === "" || v.length <= 500, {
      message: "Description must be 500 characters or fewer",
    }),
  assigneeId: z.string().min(1, "Assignee is required"),
  dueDate: z
    .string()
    .min(1, "Due date is required")
    .refine((v) => ISO_DATE.test(v), { message: "Use a valid date" }),
  priority: z.enum(TASK_PRIORITIES),
});

export type CreateTaskValues = z.infer<typeof createTaskSchema>;

export const EMPTY_CREATE_FORM: CreateTaskValues = {
  title: "",
  description: "",
  assigneeId: "",
  dueDate: "",
  priority: "MEDIUM",
};

export const reassignTaskSchema = z.object({
  assigneeId: z.string().min(1, "New assignee is required"),
});

export type ReassignTaskValues = z.infer<typeof reassignTaskSchema>;

/** Self-service create: same title/description/dueDate/priority rules as the
 * admin form, plus the legacy "Request Admin/HR attention" flag. There is no
 * assignee — the employee is resolved from the JWT. */
export const createMyTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(80, "Title must be 80 characters or fewer"),
  description: z
    .string()
    .trim()
    .refine((v) => v === "" || v.length <= 500, {
      message: "Description must be 500 characters or fewer",
    }),
  dueDate: z
    .string()
    .min(1, "Due date is required")
    .refine((v) => ISO_DATE.test(v), { message: "Use a valid date" }),
  priority: z.enum(TASK_PRIORITIES),
  requestToAdmin: z.boolean(),
});

export type CreateMyTaskValues = z.infer<typeof createMyTaskSchema>;

export const EMPTY_CREATE_MY_TASK_FORM: CreateMyTaskValues = {
  title: "",
  description: "",
  dueDate: "",
  priority: "MEDIUM",
  requestToAdmin: false,
};
