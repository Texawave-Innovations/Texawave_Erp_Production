import type { TicketStatus } from "./types";

export const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

/** Color token per status, passed to the shared StatusBadge. Status always
 * renders as text as well, never color alone (Docs/DESIGN_SYSTEM.md). */
export const STATUS_COLOR: Record<
  TicketStatus,
  "brand" | "success" | "warning" | "error" | "gray"
> = {
  OPEN: "warning",
  IN_PROGRESS: "brand",
  RESOLVED: "success",
  CLOSED: "gray",
};
