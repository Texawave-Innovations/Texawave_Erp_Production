/**
 * Organization attendance policy (HR master): the automatic check-out.
 * Pure — no I/O.
 *
 * Rule (Docs/ATTENDANCE_ARCHITECTURE.md §7.7): a forgotten check-out is always
 * closed at a cut-off on the session's OWN business date (IST) — the HR
 * master's time when that setting is on, otherwise the end of the day
 * (`END_OF_DAY_CUTOFF`). A session never runs past IST midnight, so a
 * forgotten check-out on one day cannot credit hours to the next. Every
 * session the system closes is flagged `autoClosed`: its close time is the
 * system's, not the employee's, so it counts no worked time until HR
 * regularizes it with the real check-out time.
 */

export const DEFAULT_AUTO_CHECKOUT_TIME = "20:00";
/** The cut-off used when the HR master's earlier cut-off is switched off. */
export const END_OF_DAY_CUTOFF = "23:59";
/** 24-hour `HH:mm`. Mirrors the database CHECK. */
export const AUTO_CHECKOUT_TIME_PATTERN = FIELD_FORMAT.time;

export interface AttendanceRules {
  autoCheckoutEnabled: boolean;
  /** `HH:mm`, IST. */
  autoCheckoutTime: string;
}

export const RULE_KEYS = ["autoCheckoutEnabled", "autoCheckoutTime"] as const;

export const DEFAULT_RULES: AttendanceRules = {
  autoCheckoutEnabled: false,
  autoCheckoutTime: DEFAULT_AUTO_CHECKOUT_TIME,
};

export function toRules(
  row: { autoCheckoutEnabled: boolean; autoCheckoutTime: string } | null,
): AttendanceRules {
  if (!row) return { ...DEFAULT_RULES };
  return {
    autoCheckoutEnabled: row.autoCheckoutEnabled,
    autoCheckoutTime: row.autoCheckoutTime,
  };
}

/** The cut-off actually applied: the HR master's time when it is switched on,
 * otherwise the end of the day. There is always one, so no forgotten session
 * stays open. */
export function effectiveCutoffTime(rules: AttendanceRules): string {
  return rules.autoCheckoutEnabled ? rules.autoCheckoutTime : END_OF_DAY_CUTOFF;
}

const IST_OFFSET = "+05:30";

/**
 * The instant a session on `attendanceDate` (IST, `YYYY-MM-DD`) is closed by the
 * cut-off, or null when it cannot be closed without running past the day.
 *
 *  - Normal case: the cut-off instant on that date.
 *  - Checked in at or after the cut-off: the last instant of that IST day (the
 *    close time must be after the check-in and must stay on the same day).
 *  - Checked in at the very last millisecond of the day: null (unreachable in
 *    practice; the day has no later instant to close at).
 */
export function fixedCloseAt(
  attendanceDate: string,
  cutoffTime: string,
  checkInAt: Date,
): Date | null {
  const cutoff = new Date(`${attendanceDate}T${cutoffTime}:00${IST_OFFSET}`);
  if (cutoff.getTime() > checkInAt.getTime()) return cutoff;
  const dayEnd = new Date(`${attendanceDate}T23:59:59.999${IST_OFFSET}`);
  return dayEnd.getTime() > checkInAt.getTime() ? dayEnd : null;
}

export interface OpenSessionForFixedCheckout {
  id: number;
  checkInAt: Date;
  /** IST business date of the session's record, `YYYY-MM-DD`. */
  attendanceDate: string;
}

export interface FixedCheckoutPlan {
  closes: { id: number; checkOutAt: Date }[];
  /** Open sessions whose cut-off has not been reached yet. */
  notDue: number;
  /** Open sessions that cannot be closed inside their own day. */
  unclosable: number;
}

/** Pure decision: which open sessions the fixed cut-off closes at `asOf`. */
export function planFixedCheckouts(
  sessions: readonly OpenSessionForFixedCheckout[],
  cutoffTime: string,
  asOf: Date,
): FixedCheckoutPlan {
  const plan: FixedCheckoutPlan = { closes: [], notDue: 0, unclosable: 0 };
  for (const session of sessions) {
    const closeAt = fixedCloseAt(
      session.attendanceDate,
      cutoffTime,
      session.checkInAt,
    );
    if (closeAt === null) {
      plan.unclosable += 1;
      continue;
    }
    // Due once the day's cut-off has passed; the close time itself may be later
    // (late check-in), in which case it is due when that instant passes.
    if (closeAt.getTime() > asOf.getTime()) {
      plan.notDue += 1;
      continue;
    }
    plan.closes.push({ id: session.id, checkOutAt: closeAt });
  }
  return plan;
}
import { FIELD_FORMAT } from "../../../../common/dto/field-formats.js";
