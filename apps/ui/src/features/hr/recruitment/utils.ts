"use client";

import { ApiError } from "@texawave-erp/core";
import { useEffect, useState } from "react";

/** Message for a failed call. A 400 carries the backend's own validation
 * messages, which are shown as they come back. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.isValidationError) return error.fieldErrors.join(". ");
    if (error.isPermissionError) {
      return "You do not have permission to do this.";
    }
    if (error.isNotFound) {
      return "This record was not found. It may have been removed.";
    }
    return error.message || fallback;
  }
  return fallback;
}

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** Formats a `YYYY-MM-DD` date for display, without a timezone shift. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

/** Formats a decimal string as Indian-grouped rupees, e.g. ₹ 1,23,456.00. */
export function formatRupees(value: string | null | undefined): string {
  if (value === undefined || value === null || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return `₹ ${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Adds whole days to a `YYYY-MM-DD` string (UTC, so no DST drift). */
export function addDaysToDateOnly(value: string, days: number): string {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

export function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}
