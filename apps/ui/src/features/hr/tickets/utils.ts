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

/** Formats a date string into readable `DD MMM YYYY` (e.g. 15 Oct 2026) */
export function formatTicketDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/** Formats a date string into `DD MMM YYYY, hh:mm A` (e.g. 15 Oct 2026, 10:30 AM) */
export function formatTicketDateTime(
  dateStr: string | null | undefined,
): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const date = d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const time = d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return `${date}, ${time}`;
  } catch {
    return dateStr;
  }
}
