/**
 * Organization attendance policy (HR master): the fixed automatic check-out.
 * Pure — no I/O.
 *
 * Rule: when enabled, an open session is closed at the cut-off time (IST) of its
 * OWN business date. A session never runs past IST midnight, so a forgotten
 * check-out on one day cannot credit hours to the next. Sessions the system
 * closes are flagged `autoClosed`; the day stays pending until HR regularizes it.
 */

export const DEFAULT_AUTO_CHECKOUT_TIME = "20:00";
/** 24-hour `HH:mm`. Mirrors the database CHECK. */
export const AUTO_CHECKOUT_TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

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

const IST_OFFSET = "+05:30";

/**
 * The instant a session on `attendanceDate` (IST, `YYYY-MM-DD`) is closed by the
 * fixed cut-off, or null when it cannot be closed without running past the day.
 *
 *  - Normal case: the cut-off instant on that date.
 *  - Checked in at or after the cut-off: the last minute of that IST day (the
 *    close time must be after the check-in and must stay on the same day).
 *  - Checked in within the last minute of the day: null — left open for HR.
 */
export function fixedCloseAt(
  attendanceDate: string,
  cutoffTime: string,
  checkInAt: Date,
): Date | null {
  const cutoff = new Date(`${attendanceDate}T${cutoffTime}:00${IST_OFFSET}`);
  if (cutoff.getTime() > checkInAt.getTime()) return cutoff;
  const dayEnd = new Date(`${attendanceDate}T23:59:00${IST_OFFSET}`);
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
