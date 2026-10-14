import type {
  DailyAttendanceRow,
  EmployeeRow,
  ExpenseClaimRow,
  HolidayRow,
  LeaveRequestRow,
  TicketRow,
} from "./types";

/** Calendar date in India Standard Time, `YYYY-MM-DD`. The API counts "today" in IST too. */
export function istToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Adds whole days to a `YYYY-MM-DD` string using UTC arithmetic, so no local TZ leaks in. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function monthRange(today: string): { from: string; to: string } {
  const y = today.slice(0, 4);
  const mm = today.slice(5, 7);
  const last = new Date(Date.UTC(Number(y), Number(mm), 0)).getUTCDate();
  return {
    from: `${y}-${mm}-01`,
    to: `${y}-${mm}-${String(last).padStart(2, "0")}`,
  };
}

export interface AttendanceCounts {
  present: number;
  absent: number;
  onLeave: number;
}

/**
 * Legacy "present" was the stored PRESENT count; the production derived status
 * is the equivalent. NOT_MARKED, HALF_DAY, WEEKLY_OFF and HOLIDAY are deliberately
 * not folded into absent: an unmarked day is not an absence.
 */
export function countAttendance(
  rows: readonly DailyAttendanceRow[],
): AttendanceCounts {
  let present = 0;
  let absent = 0;
  let onLeave = 0;
  for (const r of rows) {
    if (r.status === "PRESENT") present += 1;
    else if (r.status === "ABSENT") absent += 1;
    else if (r.status === "ON_LEAVE") onLeave += 1;
  }
  return { present, absent, onLeave };
}

/** Working weekdays (Mon–Fri) in the last `calendarDays` days, newest first, including today. */
export function workdayLookback(today: string, calendarDays = 21): string[] {
  const dates: string[] = [];
  for (let i = 0; i < calendarDays; i += 1) {
    const date = addDays(today, -i);
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (dow !== 0 && dow !== 6) dates.push(date);
  }
  return dates;
}

export type WeekdayLabel = "Mon" | "Tue" | "Wed" | "Thu" | "Fri";

/** Index 0 = Monday (getUTCDay() 1). Weekends are never passed in by `workdayLookback`. */
const WEEKDAYS: readonly WeekdayLabel[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/** Absence totals per weekday (Mon..Fri) across the given per-date absent counts. */
export function absencesByWeekday(
  perDate: ReadonlyArray<{ date: string; absent: number }>,
): Array<{ day: WeekdayLabel; absences: number }> {
  const totals: Record<WeekdayLabel, number> = {
    Mon: 0,
    Tue: 0,
    Wed: 0,
    Thu: 0,
    Fri: 0,
  };
  for (const { date, absent } of perDate) {
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    const label = WEEKDAYS[dow - 1];
    if (label) totals[label] += absent;
  }
  return WEEKDAYS.map((day) => ({ day, absences: totals[day] }));
}

export function leaveTypeBreakdown(
  rows: readonly LeaveRequestRow[],
): Array<{ type: string; count: number }> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    counts.set(r.leaveType.name, (counts.get(r.leaveType.name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

export interface GlanceEvent {
  id: string;
  type: "leave" | "holiday" | "anniversary";
  name: string;
  detail: string;
}

/**
 * Today-at-a-glance: leave today, holidays in the next 7 days, work anniversaries.
 * Birthdays are NOT derived: date of birth lives only on the sensitive profile
 * endpoint, so there is no safe population-level source for it (backend data gap).
 */
export function buildGlanceEvents(input: {
  today: string;
  onLeave: readonly DailyAttendanceRow[];
  holidays: readonly HolidayRow[];
  employees: readonly EmployeeRow[];
}): GlanceEvent[] {
  const events: GlanceEvent[] = [];
  for (const r of input.onLeave) {
    events.push({
      id: `leave-${r.employeeId}`,
      type: "leave",
      name: r.employee.fullName,
      detail: "On approved leave today",
    });
  }

  const horizon = addDays(input.today, 7);
  for (const h of input.holidays) {
    if (h.holidayDate >= input.today && h.holidayDate <= horizon) {
      events.push({
        id: `holiday-${h.id}`,
        type: "holiday",
        name: h.name,
        detail: `Upcoming on ${formatShortDate(h.holidayDate)}`,
      });
    }
  }

  const [, todayMonth, todayDay] = input.today.split("-");
  const todayYear = Number(input.today.slice(0, 4));
  for (const e of input.employees) {
    if (e.status !== "ACTIVE") continue;
    const [jy, jm, jd] = e.dateOfJoining.split("-");
    if (jm !== todayMonth || jd !== todayDay) continue;
    const years = todayYear - Number(jy);
    if (years > 0) {
      events.push({
        id: `anniv-${e.id}`,
        type: "anniversary",
        name: e.fullName,
        detail: `Celebrating ${years} year${years > 1 ? "s" : ""} at the company`,
      });
    }
  }
  return events;
}

export interface ActivityItem {
  id: string;
  kind: "ticket" | "expense";
  title: string;
  detail: string;
  timestamp: number;
}

/**
 * Merges the most recent tickets and expense claims. Employee audit logs are not
 * in this feed: production has no aggregate audit-log endpoint (backend data gap).
 */
export function buildActivityFeed(
  tickets: readonly TicketRow[],
  expenses: readonly ExpenseClaimRow[],
  limit = 6,
): ActivityItem[] {
  const items: ActivityItem[] = [
    ...tickets.map((t) => ({
      id: `ticket-${t.id}`,
      kind: "ticket" as const,
      title: `Ticket: ${t.subject}`,
      detail: `${t.employee.fullName} · ${t.category.replace(/_/g, " ").toLowerCase()}`,
      timestamp: Date.parse(t.createdAt),
    })),
    ...expenses.map((e) => ({
      id: `expense-${e.id}`,
      kind: "expense" as const,
      title: `Expense: ${e.expenseType.replace(/_/g, " ").toLowerCase()} (₹${e.amount.toLocaleString("en-IN")})`,
      detail: `${e.employee.fullName} · ${e.description || "No description"}`,
      timestamp: Date.parse(e.createdAt),
    })),
  ];
  return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

function formatShortDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}
