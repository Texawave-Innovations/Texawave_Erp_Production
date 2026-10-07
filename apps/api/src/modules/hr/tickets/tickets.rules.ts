import {
  BusinessRuleViolationException,
  InvalidStateTransitionException,
} from "../../../common/exceptions/business.exception.js";

export const TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Legacy admin form: every category the admin can choose. */
export const TICKET_CATEGORIES = [
  "Attendance",
  "Salary",
  "Leave",
  "Documents",
  "IT Support",
  "HR Query",
  "Notice",
  "Warning",
  "Other",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

/** Legacy employee form (`RaiseTicket.tsx` CATEGORIES): an employee cannot
 * raise a Notice or a Warning, those are HR's to send. */
export const EMPLOYEE_TICKET_CATEGORIES: readonly TicketCategory[] = [
  "Attendance",
  "Salary",
  "Leave",
  "Documents",
  "IT Support",
  "HR Query",
  "Other",
];

/** The slice of a ticket the lifecycle rules read. */
export interface TicketState {
  status: TicketStatus;
  raisedByAdmin: boolean;
}

/**
 * Admin moves (legacy: the status dropdown and the Reopen button). Legacy
 * allowed any status to any other; production allows only these, so a
 * closed ticket cannot be silently moved sideways. Reopening is a move back
 * to OPEN from RESOLVED or CLOSED. PRODUCTION DECISION (Docs/HR_EMPLOYEE_TICKETS.md §3).
 */
const ADMIN_MOVES: Record<TicketStatus, readonly TicketStatus[]> = {
  OPEN: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["OPEN", "RESOLVED", "CLOSED"],
  RESOLVED: ["OPEN", "CLOSED"],
  CLOSED: ["OPEN"],
};

/** Returns `true` when the ticket is already in `target` (a no-op the caller
 * answers without writing). Throws for a move the lifecycle does not allow. */
export function assertAdminStatusChange(
  state: TicketState,
  target: TicketStatus,
): boolean {
  if (state.status === target) return true;
  if (!ADMIN_MOVES[state.status].includes(target)) {
    throw new InvalidStateTransitionException("Ticket", state.status, target);
  }
  return false;
}

/** A move back to OPEN from a finished ticket (legacy "Reopen"). */
export function isReopen(from: TicketStatus, to: TicketStatus): boolean {
  return to === "OPEN" && (from === "RESOLVED" || from === "CLOSED");
}

/** Only OPEN tickets may be edited by the employee. Legacy had no guard, so
 * this is a PRODUCTION DECISION (K2 in the parity doc). Admin-raised tickets
 * are read-only to the employee, as in the legacy notices section. */
export function assertEmployeeEditable(state: TicketState): void {
  if (state.raisedByAdmin) {
    throw new BusinessRuleViolationException(
      "A ticket raised by HR cannot be edited by the employee",
      "ADMIN_RAISED_TICKET_NOT_EDITABLE",
    );
  }
  if (state.status !== "OPEN") {
    throw new BusinessRuleViolationException(
      "Only an open ticket can be edited",
      "TICKET_NOT_EDITABLE",
    );
  }
}

/** HR replies are accepted while the ticket is active. Legacy showed the reply
 * box only for open and in-progress tickets (`AdminTickets.tsx` `isActive`). */
export function assertHrCanReply(state: TicketState): void {
  if (state.status !== "OPEN" && state.status !== "IN_PROGRESS") {
    throw new BusinessRuleViolationException(
      "Replies are accepted only while the ticket is open or in progress",
      "TICKET_NOT_ACTIVE",
    );
  }
}

/** Employees reply only to tickets HR raised for them. Legacy had a reply
 * control on admin notices only; an employee's own ticket has none. */
export function assertEmployeeCanReply(state: TicketState): void {
  if (!state.raisedByAdmin) {
    throw new BusinessRuleViolationException(
      "Only a ticket raised by HR takes a reply from the employee",
      "REPLY_NOT_ALLOWED",
    );
  }
}

export function assertEmployeeCategory(category: TicketCategory): void {
  if (!EMPLOYEE_TICKET_CATEGORIES.includes(category)) {
    throw new BusinessRuleViolationException(
      `Category "${category}" cannot be raised by an employee`,
      "CATEGORY_NOT_ALLOWED",
    );
  }
}

export function isActive(status: TicketStatus): boolean {
  return status === "OPEN" || status === "IN_PROGRESS";
}
