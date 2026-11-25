import type { UseQueryResult } from "@tanstack/react-query";
import type { Part, ValueFormat } from "./types";

/** Compact Indian rupees for KPI tiles: ₹950, ₹12.4K, ₹3.2L, ₹1.05Cr. */
export function compactInr(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)}L`;
  if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3)}K`;
  return `${sign}₹${Math.round(abs).toLocaleString("en-IN")}`;
}

function trim(n: number): string {
  return n >= 100
    ? Math.round(n).toString()
    : n.toFixed(n >= 10 ? 1 : 2).replace(/\.?0+$/, "");
}

export function formatValue(value: number, format: ValueFormat): string {
  if (format === "currency") return compactInr(value);
  if (format === "percent") return `${Math.round(value)}%`;
  return Math.round(value).toLocaleString("en-IN");
}

export function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/** API money fields arrive as 2-dp decimal strings; a bad value reads as 0, never NaN. */
export function num(value: string | number | null | undefined): number {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "?";
  const last = parts[parts.length - 1] ?? "";
  return (
    parts.length > 1 ? first.charAt(0) + last.charAt(0) : first.slice(0, 2)
  ).toUpperCase();
}

/**
 * Builds a widget `Part` from a query. Uses `isLoading` (not `isPending`):
 * a disabled query — no permission — is "pending" forever in React Query v5,
 * and must render as "no access", not as an endless skeleton.
 */
export function toPart<TData, TOut>(
  query: Pick<
    UseQueryResult<TData>,
    "data" | "isLoading" | "isError" | "refetch"
  >,
  map: (data: TData) => TOut,
): Part<TOut> {
  return {
    data: query.data === undefined ? null : map(query.data),
    loading: query.isLoading,
    error: query.isError,
    retry: () => void query.refetch(),
  };
}

export const EMPTY_PART: Part<never> = {
  data: null,
  loading: false,
  error: false,
  retry: () => undefined,
};
