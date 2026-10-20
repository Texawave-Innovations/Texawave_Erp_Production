type Token = "success" | "gray" | "warning" | "error" | "brand";

/** `PARTIALLY_RECEIVED` -> `Partially Received` (legacy `formatStatusLabel`). */
export function formatStatusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function formatQty(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 3 });
}

export function formatMoney(
  value: string | number | null | undefined,
  currency = "INR",
  maximumFractionDigits = 2,
): string {
  const n = Number(value ?? 0);
  const code = /^[A-Z]{3}$/.test(currency) ? currency : "INR";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: code,
    maximumFractionDigits,
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

/** Document / status -> StatusBadge colour, covering every SCM status enum. */
export function scmStatusToken(status: string): Token {
  switch (status) {
    case "ACTIVE":
    case "Active":
    case "APPROVED":
    case "COMPLETED":
    case "RECEIVED":
    case "PACKED":
    case "DELIVERED":
    case "FULFILLED":
    case "PASS":
    case "PASSED":
    case "RELEASED":
    case "AVAILABLE":
    case "RESPONDED":
    case "SELECTED":
    case "CLOSED":
    case "Healthy":
    case "DECIDED":
    case "ACCEPTED":
      return "success";
    case "DRAFT":
    case "PENDING":
    case "PENDING_APPROVAL":
    case "REQUESTED":
    case "SUBMITTED":
    case "UNDER_REVIEW":
    case "SHORTLISTED":
    case "RESPONSES_PENDING":
    case "PARTIALLY_RECEIVED":
    case "PARTIALLY_RESPONDED":
    case "PARTIALLY_PICKED":
    case "PARTIALLY_PASSED":
    case "PARTIAL_PASS":
    case "PARTIALLY_AVAILABLE":
    case "Low Stock":
    case "Pending Approval":
    case "ON_HOLD":
    case "HOLD":
    case "OPEN":
      return "warning";
    case "CANCELLED":
    case "REJECTED":
    case "FAILED":
    case "FAIL":
    case "BLOCKED":
    case "EXPIRED":
    case "DAMAGED":
    case "Out of Stock":
    case "Blocked":
    case "DELIVERY_EXCEPTION":
    case "FAILED_DELIVERY":
      return "error";
    case "IN_TRANSIT":
    case "IN_PROGRESS":
    case "ASSIGNED":
    case "SENT":
    case "ISSUED":
    case "QUARANTINED":
    case "RESERVED":
    case "Overstock":
      return "brand";
    default:
      return "gray";
  }
}
