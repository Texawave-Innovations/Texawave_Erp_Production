import { Injectable } from "@nestjs/common";

/**
 * The ONLY place attendance status and hours are derived
 * (Docs/ATTENDANCE_ARCHITECTURE.md §1). Controllers, repositories, DTOs,
 * reports and corrections all call this; none of them may recompute a status
 * or an hour figure.
 *
 * Pure and deterministic: every input, including "now", is passed in. Nothing
 * here reads the clock, the database or the request.
 *
 * Rules implemented (sources: Docs/ATTENDANCE_LEGACY_PARITY.md, and the
 * decisions recorded in Docs/ATTENDANCE_ARCHITECTURE.md §7):
 *  - Calendar precedence: HOLIDAY > WEEKLY_OFF > ON_LEAVE > stored status.
 *  - Stored ABSENT means zero worked minutes, whatever punches exist.
 *  - Stored HALF_DAY means worked = target / 2, shortfall = the other half
 *    (legacy pendingHrs = target / 2), and no overtime.
 *  - Holiday / leave days keep punched time (never destroyed); no overtime and
 *    no shortfall are reported for them.
 *  - Weekly-off days cap worked at target and report no overtime (legacy
 *    Sunday behaviour, generalised to any configured weekly-off day).
 *  - Normal day: worked = min(actual, target); overtime = max(actual - target,
 *    0); shortfall = max(target - actual, 0).
 *  - No shift target → hours are reported as punched, with no overtime or
 *    shortfall (the target is unknown, so neither can be computed honestly).
 *  - An open session counts time up to `asOf`.
 */

export const STORED_STATUSES = ["PRESENT", "ABSENT", "HALF_DAY"] as const;
export type StoredStatus = (typeof STORED_STATUSES)[number];

export const EFFECTIVE_STATUSES = [
  "PRESENT",
  "ABSENT",
  "HALF_DAY",
  "HOLIDAY",
  "WEEKLY_OFF",
  "ON_LEAVE",
  "NOT_MARKED",
] as const;
export type EffectiveStatus = (typeof EFFECTIVE_STATUSES)[number];

export interface CalendarFlags {
  holiday: boolean;
  weeklyOff: boolean;
  onLeave: boolean;
  /** Exactly one half of the day is approved leave; the other half is worked. */
  halfDayLeave?: boolean;
}

export interface PunchSession {
  checkInAt: Date;
  checkOutAt: Date | null;
}

export interface AttendanceDayInput {
  storedStatus: StoredStatus | null;
  sessions: readonly PunchSession[];
  /** Expected working minutes from the applicable shift; null = no shift. */
  targetMinutes: number | null;
  calendar: CalendarFlags;
  asOf: Date;
}

export interface AttendanceDayResult {
  status: EffectiveStatus;
  workedMinutes: number;
  overtimeMinutes: number;
  shortfallMinutes: number;
  hasOpenSession: boolean;
}

const MS_PER_MINUTE = 60_000;
const IST_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Asia/Kolkata (IST) calendar date of an instant, as `YYYY-MM-DD`.
 * Legacy is IST-only; the business day boundary is IST midnight. */
export function istDateOf(instant: Date): string {
  return IST_DATE.format(instant);
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a `YYYY-MM-DD` calendar date. */
export function isoWeekdayOf(dateOnly: string): number {
  const day = new Date(`${dateOnly}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Sum of closed session time, plus open-session time up to `asOf`, whole
 * minutes (floored). Sessions are assumed non-overlapping; the write paths
 * enforce that. */
export function workedMinutesOf(
  sessions: readonly PunchSession[],
  asOf: Date,
): { minutes: number; hasOpenSession: boolean } {
  let ms = 0;
  let hasOpenSession = false;
  for (const session of sessions) {
    const end = session.checkOutAt ?? asOf;
    if (session.checkOutAt === null) hasOpenSession = true;
    ms += Math.max(end.getTime() - session.checkInAt.getTime(), 0);
  }
  return { minutes: Math.floor(ms / MS_PER_MINUTE), hasOpenSession };
}

@Injectable()
export class AttendanceCalculationService {
  calculate(input: AttendanceDayInput): AttendanceDayResult {
    const { minutes: actual, hasOpenSession } = workedMinutesOf(
      input.sessions,
      input.asOf,
    );
    const target = input.targetMinutes;
    const base = { hasOpenSession };

    // 1. Calendar precedence (Holiday > Weekly Off > Leave).
    if (input.calendar.holiday) {
      return {
        ...base,
        status: "HOLIDAY",
        workedMinutes: actual,
        overtimeMinutes: 0,
        shortfallMinutes: 0,
      };
    }
    if (input.calendar.weeklyOff) {
      const worked = target === null ? actual : Math.min(actual, target);
      return {
        ...base,
        status: "WEEKLY_OFF",
        workedMinutes: worked,
        overtimeMinutes: 0,
        shortfallMinutes: 0,
      };
    }
    if (input.calendar.onLeave) {
      return {
        ...base,
        status: "ON_LEAVE",
        workedMinutes: actual,
        overtimeMinutes: 0,
        shortfallMinutes: 0,
      };
    }

    if (input.calendar.halfDayLeave) {
      // One half is leave, so the day is a half day: the same fixed half-target
      // allocation a stored HALF_DAY gets. Without a target the punches stand.
      const worked = target === null ? actual : Math.floor(target / 2);
      return {
        ...base,
        status: "HALF_DAY",
        workedMinutes: worked,
        overtimeMinutes: 0,
        shortfallMinutes: target === null ? 0 : target - worked,
      };
    }

    // 2. Explicit stored status.
    if (input.storedStatus === "ABSENT") {
      return {
        ...base,
        status: "ABSENT",
        workedMinutes: 0,
        overtimeMinutes: 0,
        shortfallMinutes: target ?? 0,
      };
    }
    if (input.storedStatus === "HALF_DAY") {
      // Legacy computeClosedSessionHours: a Half Day is a fixed half-target
      // allocation, and its pending (shortfall) is that same half. Without a
      // target there is nothing to allocate, so the punched time stands.
      const worked = target === null ? actual : Math.floor(target / 2);
      return {
        ...base,
        status: "HALF_DAY",
        workedMinutes: worked,
        overtimeMinutes: 0,
        shortfallMinutes: target === null ? 0 : target - worked,
      };
    }

    // 3. Punched or unmarked day.
    if (input.sessions.length === 0) {
      // Stored PRESENT with no punches: HR marked presence explicitly, so it
      // stands; the hours are unknown and reported as zero.
      return {
        ...base,
        status: input.storedStatus === "PRESENT" ? "PRESENT" : "NOT_MARKED",
        workedMinutes: 0,
        overtimeMinutes: 0,
        shortfallMinutes: target ?? 0,
      };
    }
    if (target === null) {
      return {
        ...base,
        status: "PRESENT",
        workedMinutes: actual,
        overtimeMinutes: 0,
        shortfallMinutes: 0,
      };
    }
    return {
      ...base,
      status: "PRESENT",
      workedMinutes: Math.min(actual, target),
      overtimeMinutes: Math.max(actual - target, 0),
      shortfallMinutes: Math.max(target - actual, 0),
    };
  }
}

/** Throws if two sessions overlap, or a session is not ordered. Used by every
 * write path that changes punches (HR edit, correction approval) so the rule
 * lives in one place. Sessions are checked in check-in order. */
export function assertSessionsConsistent(
  sessions: readonly PunchSession[],
): void {
  const ordered = [...sessions].sort(
    (a, b) => a.checkInAt.getTime() - b.checkInAt.getTime(),
  );
  for (let i = 0; i < ordered.length; i += 1) {
    const current = ordered[i]!;
    if (
      current.checkOutAt !== null &&
      current.checkOutAt <= current.checkInAt
    ) {
      throw new SessionOrderError("A session must end after it starts");
    }
    const next = ordered[i + 1];
    if (!next) continue;
    if (current.checkOutAt === null) {
      throw new SessionOrderError("Only the last session of a day may be open");
    }
    if (current.checkOutAt > next.checkInAt) {
      throw new SessionOrderError("Sessions may not overlap");
    }
  }
}

export class SessionOrderError extends Error {}
