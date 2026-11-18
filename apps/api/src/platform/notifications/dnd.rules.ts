/**
 * Do Not Disturb (snooze) for the notification bell. Pure — no I/O.
 *
 * It only quiets the badge: notifications are still created and stored, so
 * nothing is lost. A timed snooze is active while `until` is in the future; an
 * expired one is just inactive, so no job is needed to switch it off.
 */

/** The longest timed snooze. "Until I turn it off" is `indefinite`. */
export const MAX_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export interface DndPreference {
  dndUntil: Date | null;
  dndIndefinite: boolean;
}

export interface DndState {
  /** Snoozed right now. */
  active: boolean;
  /** When a timed snooze ends; null when off or indefinite. */
  until: string | null;
  indefinite: boolean;
}

export const DND_OFF: DndState = {
  active: false,
  until: null,
  indefinite: false,
};

export function dndStateOf(pref: DndPreference | null, now: Date): DndState {
  if (!pref) return DND_OFF;
  if (pref.dndIndefinite) {
    return { active: true, until: null, indefinite: true };
  }
  if (pref.dndUntil && pref.dndUntil.getTime() > now.getTime()) {
    return {
      active: true,
      until: pref.dndUntil.toISOString(),
      indefinite: false,
    };
  }
  return DND_OFF;
}

export type DndRequestError =
  "BOTH_GIVEN" | "UNTIL_NOT_IN_FUTURE" | "UNTIL_TOO_FAR";

/**
 * Validates a snooze request. `until` and `indefinite` are mutually exclusive;
 * neither means "turn it off". Returns an error code, or null when valid.
 */
export function checkDndRequest(
  req: { until: Date | null; indefinite: boolean },
  now: Date,
): DndRequestError | null {
  if (req.indefinite && req.until) return "BOTH_GIVEN";
  if (req.until) {
    if (req.until.getTime() <= now.getTime()) return "UNTIL_NOT_IN_FUTURE";
    if (req.until.getTime() - now.getTime() > MAX_SNOOZE_MS) {
      return "UNTIL_TOO_FAR";
    }
  }
  return null;
}
