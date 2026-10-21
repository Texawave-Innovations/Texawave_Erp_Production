import type { EffectiveStatus } from "./types";
import {
  formatTime as coreFormatTime,
  type FormatTimeOptions,
  type TimeFormat,
} from "@texawave-erp/core";

export const STATUS_LABELS: Record<EffectiveStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  HALF_DAY: "Half Day",
  HOLIDAY: "Holiday",
  WEEKLY_OFF: "Weekly Off",
  ON_LEAVE: "On Leave",
  NOT_MARKED: "Not Marked",
};

/** Color token per status, passed to the shared StatusBadge. */
export const STATUS_COLOR: Record<
  EffectiveStatus,
  "brand" | "gray" | "success" | "warning" | "error"
> = {
  PRESENT: "success",
  ABSENT: "error",
  HALF_DAY: "warning",
  HOLIDAY: "brand",
  WEEKLY_OFF: "gray",
  ON_LEAVE: "brand",
  NOT_MARKED: "gray",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Minutes → "Hh Mm", used for worked/overtime/shortfall columns. */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${pad(m)}m`;
}

export function formatTime(
  iso: string,
  formatOrOptions?: TimeFormat | FormatTimeOptions,
  timeZone?: string,
): string {
  if (!iso) return "—";
  return coreFormatTime(iso, formatOrOptions, timeZone);
}
