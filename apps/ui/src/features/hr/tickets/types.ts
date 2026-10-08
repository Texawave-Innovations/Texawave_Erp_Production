/** Mirrors apps/api/src/modules/hr/tickets/tickets.rules.ts and
 * tickets.repository.ts (TicketView / TicketDetailView / TicketCommentView). */
export const TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Admin category set (tickets.rules.ts TICKET_CATEGORIES). */
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

/** Admin moves allowed per current status (tickets.rules.ts ADMIN_MOVES).
 * Same-status is always a no-op, not listed here. */
export const ADMIN_MOVES: Readonly<
  Record<TicketStatus, readonly TicketStatus[]>
> = {
  OPEN: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
  IN_PROGRESS: ["OPEN", "RESOLVED", "CLOSED"],
  RESOLVED: ["OPEN", "CLOSED"],
  CLOSED: ["OPEN"],
};

export interface TicketPersonRef {
  id: number;
  fullName: string;
}

/** Row shape of GET /hr/tickets and /hr/tickets/:id (TicketView). */
export interface TicketItem {
  id: number;
  category: TicketCategory;
  subject: string;
  description: string;
  status: TicketStatus;
  isActive: boolean;
  raisedByAdmin: boolean;
  raisedBy: TicketPersonRef | null;
  employee: TicketPersonRef;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketComment {
  id: number;
  authorKind: "HR" | "EMPLOYEE";
  author: TicketPersonRef | null;
  body: string;
  createdAt: string;
}

/** Row shape of GET /hr/tickets/:id (TicketDetailView): the ticket plus its
 * comments thread, oldest first. */
export interface TicketDetail extends TicketItem {
  comments: TicketComment[];
}
