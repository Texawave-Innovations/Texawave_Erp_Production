import type {
  CorrectionStatus,
  CorrectionType,
  EffectiveStatus,
} from "./types";

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

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export const CORRECTION_TYPE_LABELS: Record<CorrectionType, string> = {
  MISSED_CHECK_IN: "Missed check-in",
  MISSED_CHECK_OUT: "Missed check-out",
  INCORRECT_TIME: "Incorrect time",
  LATE_ARRIVAL: "Late arrival",
  EARLY_DEPARTURE: "Early departure",
};

export const CORRECTION_STATUS_LABELS: Record<CorrectionStatus, string> = {
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

/** Color token per status, passed to the shared StatusBadge. */
export const CORRECTION_STATUS_COLOR: Record<
  CorrectionStatus,
  "success" | "warning" | "error"
> = {
  SUBMITTED: "warning",
  APPROVED: "success",
  REJECTED: "error",
};
