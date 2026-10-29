import { formatDate, formatDateTime } from "@texawave-erp/core";

/** Formats a numeric ticket ID into the enterprise display format `TK-YYYY-XXXX` */
export function formatTicketId(id: number, createdAt?: string | null): string {
  let year = new Date().getFullYear();
  if (createdAt) {
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) {
      year = d.getFullYear();
    }
  }
  return `TK-${year}-${String(id).padStart(4, "0")}`;
}

/** Formats a date string into readable date */
export function formatTicketDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const formatted = formatDate(dateStr);
    return formatted || dateStr;
  } catch {
    return dateStr;
  }
}

/** Formats a date string into readable date and time */
export function formatTicketDateTime(
  dateStr: string | null | undefined,
): string {
  if (!dateStr) return "—";
  try {
    const formatted = formatDateTime(dateStr, { separator: ", " });
    return formatted || dateStr;
  } catch {
    return dateStr;
  }
}
