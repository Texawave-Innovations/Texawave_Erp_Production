// Product expiry (legacy "Phase 12d"). A batch-tracked product already has a
// real, authoritative per-lot expiry date — this never overrides or
// aggregates those into one invented date; it only adds a manual,
// product-level date for the SKUs that have no batch records, and reports
// which source is in play so every caller (the product page, the barcode
// table, scan results, labels) renders the same thing.

export const EXPIRY_SOON_DAYS = 30;
export type ExpiryStatus = "EXPIRED" | "EXPIRING_SOON" | "VALID";

/** `YYYY-MM-DD` from an ISO timestamp or a plain date string. */
export const ymd = (value: string): string => value.slice(0, 10);

function parseLocalDate(value: string): Date {
  const [y, m, d] = ymd(value).split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((to.getTime() - a.getTime()) / 86_400_000);
}

/** `EXPIRED` once the date has passed, `EXPIRING_SOON` within
 * `EXPIRY_SOON_DAYS`, else `VALID`. */
export function computeExpiryStatus(
  expiryDate: string,
  today: Date = new Date(),
): ExpiryStatus {
  const days = daysBetween(today, parseLocalDate(expiryDate));
  if (days < 0) return "EXPIRED";
  if (days <= EXPIRY_SOON_DAYS) return "EXPIRING_SOON";
  return "VALID";
}

export interface BatchExpiryEntry {
  batchNumber: string;
  expiryDate: string;
  status: ExpiryStatus;
}

export interface ProductExpiryInfo {
  /** `BATCH` when the product has batch records with an expiry date (always
   * authoritative over the product-level field); `PRODUCT` for the manually
   * set date on a non-batch SKU; `NOT_APPLICABLE` when flagged as not
   * requiring expiry; `NOT_SET` when nothing has been entered either way. */
  source: "BATCH" | "PRODUCT" | "NOT_APPLICABLE" | "NOT_SET";
  /** Per-batch entries, populated only when `source === "BATCH"`. */
  batches: BatchExpiryEntry[];
  /** A single date — the product-level date, or the shared date when every
   * batch agrees. */
  date?: string;
  status?: ExpiryStatus;
}

export function productExpiryInfo(
  batches: ReadonlyArray<{ batchNumber: string; expiryDate: string | null }>,
  product: { expiryDate: string | null; expiryNotApplicable: boolean },
  today: Date = new Date(),
): ProductExpiryInfo {
  const dated = batches.filter((b) => b.expiryDate);
  if (dated.length > 0) {
    const entries: BatchExpiryEntry[] = dated.map((b) => ({
      batchNumber: b.batchNumber,
      expiryDate: ymd(b.expiryDate as string),
      status: computeExpiryStatus(b.expiryDate as string, today),
    }));
    const distinct = new Set(entries.map((e) => e.expiryDate));
    if (distinct.size === 1) {
      return {
        source: "BATCH",
        batches: entries,
        date: entries[0]!.expiryDate,
        status: entries[0]!.status,
      };
    }
    return { source: "BATCH", batches: entries };
  }
  if (product.expiryNotApplicable)
    return { source: "NOT_APPLICABLE", batches: [] };
  if (product.expiryDate) {
    return {
      source: "PRODUCT",
      batches: [],
      date: ymd(product.expiryDate),
      status: computeExpiryStatus(product.expiryDate, today),
    };
  }
  return { source: "NOT_SET", batches: [] };
}

const STATUS_LABEL: Record<ExpiryStatus, string> = {
  EXPIRED: "Expired",
  EXPIRING_SOON: "Expiring Soon",
  VALID: "Valid",
};
export const expiryStatusLabel = (s: ExpiryStatus) => STATUS_LABEL[s];

/** One-line summary for a table cell / scan-result field. */
export function formatProductExpiry(info: ProductExpiryInfo): string {
  switch (info.source) {
    case "NOT_APPLICABLE":
      return "Not applicable";
    case "NOT_SET":
      return "Not set";
    case "PRODUCT":
      return `${info.date} (${STATUS_LABEL[info.status as ExpiryStatus]})`;
    case "BATCH": {
      if (info.date) {
        return `${info.date} (${STATUS_LABEL[info.status as ExpiryStatus]})`;
      }
      const counts = info.batches.reduce(
        (acc, b) => {
          acc[b.status] = (acc[b.status] ?? 0) + 1;
          return acc;
        },
        {} as Partial<Record<ExpiryStatus, number>>,
      );
      const parts = (["EXPIRED", "EXPIRING_SOON", "VALID"] as const)
        .filter((s) => counts[s])
        .map((s) => `${counts[s]} ${STATUS_LABEL[s]}`);
      return `${info.batches.length} batches: ${parts.join(", ")}`;
    }
  }
}

/** Tailwind text colour for an expiry status. */
export function expiryTone(status: ExpiryStatus | undefined): string {
  return status === "EXPIRED"
    ? "text-error-600"
    : status === "EXPIRING_SOON"
      ? "text-warning-600"
      : status === "VALID"
        ? "text-success-600"
        : "text-gray-500";
}

/** Date/time a label was generated, e.g. "12 Oct 2026, 05:40 PM". */
export function formatLabelDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** The "Created" / "Expiry" lines printed on a product label. Expiry is
 * omitted when nothing has been entered; several batches with different dates
 * print as "Per batch". */
export function productLabelLines(
  createdAt: string | number | null | undefined,
  expiry: ProductExpiryInfo,
): string[] {
  const lines: string[] = [];
  if (createdAt) lines.push(`Created: ${formatLabelDateTime(createdAt)}`);
  if (expiry.source === "NOT_APPLICABLE") lines.push("Expiry: Not applicable");
  else if (expiry.date) {
    lines.push(
      `Expiry: ${new Date(`${expiry.date}T00:00:00`).toLocaleDateString(
        "en-GB",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        },
      )}`,
    );
  } else if (expiry.source === "BATCH") lines.push("Expiry: Per batch");
  return lines;
}
