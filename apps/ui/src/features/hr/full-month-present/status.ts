import type { EffectiveStatus } from "./types";

/** Mirrors apps/ui/src/features/hr/attendance/status.ts (same derived statuses). */
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

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
