"use client";

import { formatTime } from "../status";
import type { AttendanceSession } from "../types";

/** The window the bar spans, in IST hours (legacy roster: 9 AM – 9 PM). */
const START_HOUR = 9;
const END_HOUR = 21;
const SPAN_MIN = (END_HOUR - START_HOUR) * 60;

const IST_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Minutes after START_HOUR (IST), clamped to the bar. */
function offset(iso: string): number {
  const [h, m] = IST_PARTS.format(new Date(iso)).split(":").map(Number);
  const min = (h ?? 0) * 60 + (m ?? 0) - START_HOUR * 60;
  return Math.min(Math.max(min, 0), SPAN_MIN);
}

/**
 * A compact bar of the day's punch sessions between 9 AM and 9 PM IST. An
 * open session runs to "now" (or the bar's end). Purely visual; the session
 * times are also given as text for screen readers and tooltips.
 */
export function DayTimeline({
  sessions,
  className,
}: {
  sessions: readonly AttendanceSession[];
  className?: string;
}) {
  const label =
    sessions.length === 0
      ? "No punches"
      : sessions
          .map(
            (s) =>
              `${formatTime(s.checkInAt)}–${s.checkOutAt ? formatTime(s.checkOutAt) : "open"}`,
          )
          .join(", ");
  return (
    <div
      className={`relative h-2.5 w-full min-w-24 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800 ${className ?? ""}`}
      role="img"
      aria-label={`Sessions: ${label}`}
      title={label}
    >
      {sessions.map((s) => {
        const from = offset(s.checkInAt);
        const to = offset(s.checkOutAt ?? new Date().toISOString());
        const width = Math.max(to - from, 2);
        return (
          <span
            key={s.id}
            className={`absolute inset-y-0 rounded-full ${s.checkOutAt ? "bg-success-500" : "bg-brand-500 motion-safe:animate-pulse"}`}
            style={{
              left: `${(from / SPAN_MIN) * 100}%`,
              width: `${(width / SPAN_MIN) * 100}%`,
            }}
          />
        );
      })}
    </div>
  );
}
