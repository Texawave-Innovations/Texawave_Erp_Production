import type { CrmQuotaMetric } from "@texawave-erp/api-types";

export const METRIC_LABEL: Record<CrmQuotaMetric, string> = {
  revenue: "Revenue",
  closedWonValue: "Closed Won Value",
  dealsWon: "Deals Won",
};

const SYMBOL: Record<string, string> = { INR: "₹", USD: "$", EUR: "€" };

/** Legacy `formatMetricValue` (Quotas.tsx). */
export function formatMetricValue(
  metric: CrmQuotaMetric,
  currency: string,
  value: number,
): string {
  const n = Math.round(value).toLocaleString("en-IN");
  if (metric === "dealsWon") return `${n} deals`;
  return `${currency === "INR" ? "₹" : `${currency} `}${n}`;
}

/** Sums per currency, e.g. "₹1,000 + $50" — the cards group by currency
 * because mixing units in one number is meaningless (legacy
 * `formatMultiCurrencyTotal`). */
export function formatMultiCurrencyTotal(
  items: { amount: number; currency: string | null }[],
): string {
  const totals = new Map<string, number>();
  for (const i of items) {
    const c = i.currency || "INR";
    totals.set(c, (totals.get(c) ?? 0) + i.amount);
  }
  if (totals.size === 0) return "₹0";
  return [...totals.entries()]
    .map(
      ([c, v]) =>
        `${SYMBOL[c] ?? `${c} `}${Math.round(v).toLocaleString("en-IN")}`,
    )
    .join(" + ");
}

export function currentMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function currentQuarterKey(d = new Date()): string {
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

/** Calendar bounds for the form's Start/End defaults (local dates). */
export function periodDefaults(
  period: "monthly" | "quarterly",
  periodKey: string,
): { startDate: string; endDate: string } {
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (period === "monthly") {
    const m = /^(\d{4})-(\d{1,2})$/.exec(periodKey);
    if (!m) return { startDate: "", endDate: "" };
    const y = Number(m[1]);
    const mo = Number(m[2]);
    if (mo < 1 || mo > 12) return { startDate: "", endDate: "" };
    return {
      startDate: iso(new Date(y, mo - 1, 1)),
      endDate: iso(new Date(y, mo, 0)),
    };
  }
  const q = /^(\d{4})-Q([1-4])$/.exec(periodKey);
  if (!q) return { startDate: "", endDate: "" };
  const y = Number(q[1]);
  const n = Number(q[2]);
  return {
    startDate: iso(new Date(y, (n - 1) * 3, 1)),
    endDate: iso(new Date(y, n * 3, 0)),
  };
}
