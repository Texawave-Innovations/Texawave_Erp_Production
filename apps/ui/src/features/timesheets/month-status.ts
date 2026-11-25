import type { MonthDay } from "./types";

/**
 * Statuses that come from HR's calendar rather than from what happened on the
 * day: a holiday, a weekly off or an approved leave is known in advance, so it
 * is shown for a future date too.
 */
const KNOWN_IN_ADVANCE: readonly string[] = [
  "HOLIDAY",
  "WEEKLY_OFF",
  "ON_LEAVE",
];

/**
 * The HR status the month table shows for a day, or null for a dash. Up to
 * today the day's status is shown as is. A future day has no verdict yet
 * (it would read "Not marked"), so only a planned calendar status is shown.
 */
export function visibleMonthStatus(
  day: Pick<MonthDay, "date" | "attendanceStatus">,
  today: string,
): string | null {
  const status = day.attendanceStatus;
  if (status === null) return null;
  if (day.date <= today) return status;
  return KNOWN_IN_ADVANCE.includes(status) ? status : null;
}
