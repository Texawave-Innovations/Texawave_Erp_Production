/** Hours logged across every live project in one Monday-start week. */
export interface WeeklyHours {
  /** Monday of the week, `YYYY-MM-DD`. */
  weekStart: string;
  hours: number;
  entries: number;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `date` (`YYYY-MM-DD`). */
export function mondayOf(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  const offset = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - offset);
  return isoDay(d);
}

/** The `count` week starts ending with the current week, oldest first. */
export function weekStarts(today: string, count: number): string[] {
  const current = new Date(`${mondayOf(today)}T00:00:00.000Z`);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(current);
    d.setUTCDate(d.getUTCDate() - 7 * (count - 1 - i));
    return isoDay(d);
  });
}

/**
 * Sums time-entry minutes into the week of their `entryDate` (a calendar date
 * column, so its UTC ISO prefix is the business date). Empty weeks stay zero.
 */
export function bucketWeeklyHours(
  rows: ReadonlyArray<{ entryDate: Date; durationMinutes: number }>,
  weeks: readonly string[],
): WeeklyHours[] {
  const byWeek = new Map(weeks.map((w) => [w, { minutes: 0, entries: 0 }]));
  for (const r of rows) {
    const bucket = byWeek.get(mondayOf(isoDay(r.entryDate)));
    if (!bucket) continue;
    bucket.minutes += r.durationMinutes;
    bucket.entries += 1;
  }
  return weeks.map((weekStart) => {
    const b = byWeek.get(weekStart) as { minutes: number; entries: number };
    return {
      weekStart,
      hours: Math.round((b.minutes / 60) * 100) / 100,
      entries: b.entries,
    };
  });
}
