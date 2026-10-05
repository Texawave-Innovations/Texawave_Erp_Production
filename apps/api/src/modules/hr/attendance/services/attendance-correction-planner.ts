import { HttpStatus } from "@nestjs/common";
import { BusinessException } from "../../../../common/exceptions/business.exception.js";
import {
  assertSessionsConsistent,
  istDateOf,
  SessionOrderError,
  type PunchSession,
} from "./attendance-calculation.service.js";

/**
 * Decides exactly which punches an APPROVED correction changes. Pure: the
 * caller applies the returned plan inside the approval transaction.
 *
 * Each correction type touches only the punch it names, and only when that
 * punch unambiguously exists:
 *  - MISSED_CHECK_IN   creates the day's first session (the day must have none).
 *  - MISSED_CHECK_OUT  closes the single open session (there must be one).
 *  - INCORRECT_TIME    may move the first check-in and/or the last check-out.
 *  - LATE_ARRIVAL      moves the first check-in only.
 *  - EARLY_DEPARTURE   moves the last check-out only.
 *
 * Anything else is refused, not guessed. In particular a checkout is never
 * fabricated from an unrelated session (Docs/ATTENDANCE_LEGACY_PARITY.md §5.2).
 */

export interface CorrectionRequest {
  attendanceDate: string;
  correctionType: string;
  requestedCheckInAt: Date | null;
  requestedCheckOutAt: Date | null;
}

export interface ExistingSession extends PunchSession {
  id: number;
}

export interface CorrectionPlan {
  creates: PunchSession[];
  updates: { id: number; checkInAt?: Date; checkOutAt?: Date }[];
}

export class CorrectionNotApplicableException extends BusinessException {
  constructor(detail: string) {
    super(
      `This correction cannot be applied: ${detail}`,
      HttpStatus.UNPROCESSABLE_ENTITY,
      "CORRECTION_NOT_APPLICABLE",
    );
  }
}

/** Which punch each correction type may change. Shared with submission so a
 * request that could never be applied is refused up front. */
export const ALLOWED_TIMES: Record<string, { in: boolean; out: boolean }> = {
  MISSED_CHECK_IN: { in: true, out: true },
  MISSED_CHECK_OUT: { in: false, out: true },
  INCORRECT_TIME: { in: true, out: true },
  LATE_ARRIVAL: { in: true, out: false },
  EARLY_DEPARTURE: { in: false, out: true },
};

export function planCorrection(
  request: CorrectionRequest,
  sessions: readonly ExistingSession[],
): CorrectionPlan {
  const allowed = ALLOWED_TIMES[request.correctionType];
  if (!allowed) {
    throw new CorrectionNotApplicableException(
      `unknown type ${request.correctionType}`,
    );
  }
  const wantsIn = request.requestedCheckInAt !== null;
  const wantsOut = request.requestedCheckOutAt !== null;
  if ((wantsIn && !allowed.in) || (wantsOut && !allowed.out)) {
    throw new CorrectionNotApplicableException(
      `${request.correctionType} does not change that punch`,
    );
  }
  if (!wantsIn && !wantsOut) {
    throw new CorrectionNotApplicableException("no time was requested");
  }
  for (const t of [request.requestedCheckInAt, request.requestedCheckOutAt]) {
    if (t && istDateOf(t) !== request.attendanceDate) {
      throw new CorrectionNotApplicableException(
        "a requested time falls outside the attendance date (IST)",
      );
    }
  }

  const ordered = [...sessions].sort(
    (a, b) => a.checkInAt.getTime() - b.checkInAt.getTime(),
  );
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const plan: CorrectionPlan = { creates: [], updates: [] };

  if (request.correctionType === "MISSED_CHECK_IN") {
    if (first) {
      throw new CorrectionNotApplicableException(
        "the day already has a check-in; use INCORRECT_TIME to change it",
      );
    }
    plan.creates.push({
      checkInAt: request.requestedCheckInAt!,
      checkOutAt: request.requestedCheckOutAt,
    });
  } else if (request.correctionType === "MISSED_CHECK_OUT") {
    const open = ordered.filter((s) => s.checkOutAt === null);
    if (open.length !== 1 || open[0] !== last) {
      throw new CorrectionNotApplicableException(
        "there is no open session to close",
      );
    }
    plan.updates.push({
      id: open[0]!.id,
      checkOutAt: request.requestedCheckOutAt!,
    });
  } else {
    if (wantsIn) {
      if (!first) {
        throw new CorrectionNotApplicableException(
          "the day has no check-in to correct",
        );
      }
      plan.updates.push({
        id: first.id,
        checkInAt: request.requestedCheckInAt!,
      });
    }
    if (wantsOut) {
      if (!last) {
        throw new CorrectionNotApplicableException(
          "the day has no session to correct",
        );
      }
      const existing = plan.updates.find((u) => u.id === last.id);
      if (existing) existing.checkOutAt = request.requestedCheckOutAt!;
      else
        plan.updates.push({
          id: last.id,
          checkOutAt: request.requestedCheckOutAt!,
        });
    }
  }

  assertResultConsistent(ordered, plan);
  return plan;
}

/** The day as it would look after the plan. Overlaps and ordering are checked
 * here, before anything is written, so a bad plan changes nothing. */
function assertResultConsistent(
  ordered: readonly ExistingSession[],
  plan: CorrectionPlan,
): void {
  const resulting: PunchSession[] = ordered.map((s) => {
    const update = plan.updates.find((u) => u.id === s.id);
    return {
      checkInAt: update?.checkInAt ?? s.checkInAt,
      checkOutAt: update?.checkOutAt ?? s.checkOutAt,
    };
  });
  resulting.push(...plan.creates);
  try {
    assertSessionsConsistent(resulting);
  } catch (error) {
    if (error instanceof SessionOrderError) {
      throw new CorrectionNotApplicableException(error.message.toLowerCase());
    }
    throw error;
  }
}
