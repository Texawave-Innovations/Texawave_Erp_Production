import { z } from "zod";
import {
  EMPLOYEE_TICKET_CATEGORIES,
  TICKET_CATEGORIES,
  TICKET_STATUSES,
} from "./types";

/**
 * Client-side UX validation only. Mirrors
 * apps/api/src/modules/hr/tickets/dto/ticket.dto.ts
 * (CreateTicketDto / UpdateTicketStatusDto / CreateTicketCommentDto). The
 * backend remains authoritative — this only catches obviously malformed
 * input before a round trip.
 */
export const TICKET_SUBJECT_MAX = 200;
export const TICKET_DESCRIPTION_MAX = 5000;
export const TICKET_COMMENT_MAX = 2000;

export const createTicketSchema = z.object({
  employeeId: z
    .number({ message: "Select an employee" })
    .int("Must be a whole number")
    .min(1, "Select an employee"),
  category: z.enum(TICKET_CATEGORIES, { message: "Select a category" }),
  subject: z
    .string()
    .trim()
    .min(1, "Subject is required")
    .max(
      TICKET_SUBJECT_MAX,
      `Subject must be at most ${TICKET_SUBJECT_MAX} characters`,
    ),
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(
      TICKET_DESCRIPTION_MAX,
      `Description must be at most ${TICKET_DESCRIPTION_MAX} characters`,
    ),
});

export type CreateTicketValues = z.infer<typeof createTicketSchema>;

export const EMPTY_CREATE_TICKET_FORM = {
  employeeId: 0,
  category: "" as unknown as (typeof TICKET_CATEGORIES)[number],
  subject: "",
  description: "",
};

/**
 * Self-service raise/edit (apps/api .../dto/ticket.dto.ts
 * CreateMyTicketDto / UpdateMyTicketDto — the same shape, sent together).
 * The category set is the employee set, not the admin set.
 */
export const createMyTicketSchema = z.object({
  category: z.enum(EMPLOYEE_TICKET_CATEGORIES, {
    message: "Select a category",
  }),
  subject: z
    .string()
    .trim()
    .min(1, "Subject is required")
    .max(
      TICKET_SUBJECT_MAX,
      `Subject must be at most ${TICKET_SUBJECT_MAX} characters`,
    ),
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(
      TICKET_DESCRIPTION_MAX,
      `Description must be at most ${TICKET_DESCRIPTION_MAX} characters`,
    ),
});

export type CreateMyTicketValues = z.infer<typeof createMyTicketSchema>;

export const EMPTY_CREATE_MY_TICKET_FORM = {
  category: "" as unknown as (typeof EMPLOYEE_TICKET_CATEGORIES)[number],
  subject: "",
  description: "",
};

export const updateTicketStatusSchema = z.object({
  status: z.enum(TICKET_STATUSES, { message: "Select a status" }),
});

export const createTicketCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Reply cannot be empty")
    .max(
      TICKET_COMMENT_MAX,
      `Reply must be at most ${TICKET_COMMENT_MAX} characters`,
    ),
});

export type CreateTicketCommentValues = z.infer<
  typeof createTicketCommentSchema
>;
