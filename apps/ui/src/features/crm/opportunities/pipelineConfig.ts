// Display helpers ported from legacy `domain/config.ts` + `domain/currency.ts` for the Pipeline
// board, Opportunity drawer and Deal detail page. Pure functions only.

export type OpportunityHealth = "Healthy" | "Delayed" | "Critical";

/** Legacy fallback thresholds (days) when a stage has no SLA configured. */
export const STUCK_THRESHOLD_DAYS = { delayed: 7, critical: 14 } as const;

export function computeOpportunityHealth(
  stageEnteredAt: string | null | undefined,
  status: string,
  slaDaysOverride?: number | null,
): OpportunityHealth {
  if (status !== "OPEN" || !stageEnteredAt) return "Healthy";
  const ageDays = (Date.now() - new Date(stageEnteredAt).getTime()) / 86400000;
  const delayed = slaDaysOverride || STUCK_THRESHOLD_DAYS.delayed;
  const critical = slaDaysOverride
    ? slaDaysOverride * 2
    : STUCK_THRESHOLD_DAYS.critical;
  if (ageDays >= critical) return "Critical";
  if (ageDays >= delayed) return "Delayed";
  return "Healthy";
}

/** Whole days elapsed since an ISO timestamp (null when missing). */
export function daysSince(timestamp: string | null | undefined): number | null {
  if (!timestamp) return null;
  const t = new Date(timestamp).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

/** estimatedValue weighted by win probability (0 when probability is missing). */
export function computeExpectedRevenue(
  estimatedValue: number,
  probability: number | null | undefined,
): number {
  return Math.round((estimatedValue || 0) * ((probability ?? 0) / 100));
}

export const STAGE_COLOR_PALETTE = [
  {
    topBorder: "border-t-blue-400",
    headerBg: "bg-blue-50/70",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
    text: "text-blue-800",
  },
  {
    topBorder: "border-t-violet-400",
    headerBg: "bg-violet-50/70",
    badge: "bg-violet-100 text-violet-700 border-violet-200",
    text: "text-violet-800",
  },
  {
    topBorder: "border-t-amber-400",
    headerBg: "bg-amber-50/70",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    text: "text-amber-800",
  },
  {
    topBorder: "border-t-cyan-400",
    headerBg: "bg-cyan-50/70",
    badge: "bg-cyan-100 text-cyan-700 border-cyan-200",
    text: "text-cyan-800",
  },
  {
    topBorder: "border-t-orange-400",
    headerBg: "bg-orange-50/70",
    badge: "bg-orange-100 text-orange-700 border-orange-200",
    text: "text-orange-800",
  },
  {
    topBorder: "border-t-teal-400",
    headerBg: "bg-teal-50/70",
    badge: "bg-teal-100 text-teal-700 border-teal-200",
    text: "text-teal-800",
  },
  {
    topBorder: "border-t-pink-400",
    headerBg: "bg-pink-50/70",
    badge: "bg-pink-100 text-pink-700 border-pink-200",
    text: "text-pink-800",
  },
  {
    topBorder: "border-t-indigo-400",
    headerBg: "bg-indigo-50/70",
    badge: "bg-indigo-100 text-indigo-700 border-indigo-200",
    text: "text-indigo-800",
  },
] as const;

function paletteIndex(order: number | undefined): number {
  const n = Number.isFinite(order) ? Math.floor(order as number) : 0;
  const len = STAGE_COLOR_PALETTE.length;
  return (((n - 1) % len) + len) % len;
}

export function stageColorFor(order: number | undefined) {
  return STAGE_COLOR_PALETTE[paletteIndex(order)]!;
}

/** Hairline column-border colours mirroring STAGE_COLOR_PALETTE's order. */
const STAGE_BORDER_COLOR = [
  "border-blue-300/80",
  "border-violet-300/80",
  "border-amber-300/80",
  "border-cyan-300/80",
  "border-orange-300/80",
  "border-teal-300/80",
  "border-pink-300/80",
  "border-indigo-300/80",
] as const;

export function stageBorderFor(order: number | undefined): string {
  return STAGE_BORDER_COLOR[paletteIndex(order)]!;
}

export const HEALTH_DOT: Record<string, string> = {
  Healthy: "bg-emerald-500",
  Delayed: "bg-amber-500",
  Critical: "bg-red-500",
};

export const HEALTH_STYLE: Record<string, string> = {
  Healthy: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Delayed: "bg-amber-50 text-amber-700 border-amber-200",
  Critical: "bg-red-50 text-red-700 border-red-200",
};

export const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-blue-50 text-blue-700 border-blue-200",
  WON: "bg-emerald-50 text-emerald-700 border-emerald-200",
  LOST: "bg-red-50 text-red-700 border-red-200",
  ON_HOLD: "bg-amber-50 text-amber-700 border-amber-200",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  AED: "AED ",
};

export function currencySymbol(code?: string | null): string {
  const c = code || "INR";
  return CURRENCY_SYMBOLS[c] ?? `${c} `;
}

/** Legacy `formatMultiCurrencyTotal`: one currency -> "₹1,00,000"; several
 * -> "₹1,00,000 + $2,000". */
export function formatMultiCurrencyTotal(
  items: { amount: number; currency?: string | null }[],
): string {
  const totals = new Map<string, number>();
  for (const i of items) {
    const code = i.currency || "INR";
    totals.set(code, (totals.get(code) ?? 0) + (i.amount || 0));
  }
  if (totals.size === 0) return `${currencySymbol("INR")}0`;
  return [...totals.entries()]
    .map(
      ([code, amount]) =>
        `${currencySymbol(code)}${Math.round(amount).toLocaleString("en-IN")}`,
    )
    .join(" + ");
}

export const num = (v: string | number | null | undefined): number =>
  v === null || v === undefined || v === "" ? 0 : Number(v) || 0;

export const fmtIN = (v: string | number | null | undefined): string =>
  num(v).toLocaleString("en-IN");

/** Scoped write permission codes (`.own/.team/.all`) for `RequireScopedPermission` endpoints. */
export const OPPORTUNITY_WRITE_PERMS = [
  "crm.opportunity.write.own",
  "crm.opportunity.write.team",
  "crm.opportunity.write.all",
] as const;
