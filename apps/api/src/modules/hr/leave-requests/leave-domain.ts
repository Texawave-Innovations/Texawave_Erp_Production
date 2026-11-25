import {
  formatDateOnly,
  parseDateOnly,
} from "../../../common/dates/date-only.js";

/**
 * Pure Leave rules: lifecycle, overlap, working days and balance. No database
 * access, so every rule is unit-tested in isolation (leave-domain.spec.ts).
 * Repositories load the facts; these functions decide.
 *
 * Dates are `YYYY-MM-DD` strings, so plain string comparison is correct.
 */

export const LEAVE_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const DAY_PORTIONS = ["FULL", "FIRST_HALF", "SECOND_HALF"] as const;
export type DayPortion = (typeof DAY_PORTIONS)[number];

/** Statuses that hold a day: they reserve balance and block overlapping requests. */
export const OPEN_STATUSES: readonly LeaveStatus[] = ["PENDING", "APPROVED"];

/**
 * Allowed status moves. PENDING is the only state a decision is made from;
 * APPROVED can only be withdrawn; REJECTED and CANCELLED can only be
 * resubmitted (back to PENDING). Anything else is an invalid transition.
 */
const TRANSITIONS: Record<LeaveStatus, readonly LeaveStatus[]> = {
  PENDING: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["CANCELLED"],
  REJECTED: ["PENDING"],
  CANCELLED: ["PENDING"],
};

export function canTransition(from: LeaveStatus, to: LeaveStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function holdsDay(status: LeaveStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

export interface LeaveSpan {
  start: string;
  end: string;
  portion: DayPortion;
}

/**
 * Two requests conflict when their inclusive ranges share a day AND they do
 * not describe two different halves of that day. A full day conflicts with
 * anything it touches; two halves conflict only with the same half.
 */
export function requestsConflict(a: LeaveSpan, b: LeaveSpan): boolean {
  if (a.end < b.start || b.end < a.start) return false;
  if (a.portion === "FULL" || b.portion === "FULL") return true;
  return a.portion === b.portion;
}

/** Every date from `start` to `end`, both inclusive. Empty if reversed. */
export function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  const cursor = parseDateOnly(start);
  const last = parseDateOnly(end);
  while (cursor <= last) {
    out.push(formatDateOnly(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export function spansYears(start: string, end: string): boolean {
  return start.slice(0, 4) !== end.slice(0, 4);
}

/**
 * Working days consumed by a leave. A FULL leave counts each working date in
 * its range (1 each). A half-day is one date and counts 0.5 when that date is
 * a working day, else 0. `isWorkingDay` is the shared calendar decision
 * (holiday and weekly-off precedence), so this function never decides itself.
 */
export function countLeaveDays(
  span: LeaveSpan,
  isWorkingDay: (date: string) => boolean,
): number {
  if (span.portion !== "FULL") {
    if (span.start !== span.end) {
      throw new Error("a half-day must be a single date");
    }
    return isWorkingDay(span.start) ? 0.5 : 0;
  }
  return eachDate(span.start, span.end).filter((d) => isWorkingDay(d)).length;
}

// ---- Balance -------------------------------------------------------------

export interface BalancePolicy {
  /** Default annual entitlement of the leave type, in days. */
  annualEntitlement: number;
  /** Unused days carried into the next year are capped at this value. */
  carryForwardLimit: number;
  /** Year the leave type came into force; no balance exists before it. */
  typeFirstYear: number;
  /** Employee's date of joining (YYYY-MM-DD). */
  joiningDate: string;
  /** Employee's date of exit, or null while employed. */
  exitDate: string | null;
  /** Per-employee annual overrides, keyed by year. */
  overrides: ReadonlyMap<number, number>;
}

export interface BalanceFacts {
  /** Approved days consumed, keyed by the year of the leave's start date. */
  usedByYear: ReadonlyMap<number, number>;
  /** Days held by PENDING requests in the year being computed. */
  pendingInYear: number;
}

export interface YearBalance {
  year: number;
  opening: number;
  /** Annual entitlement that applies to the year. */
  entitlement: number;
  /** Accrued up to and including the requested month. */
  accrued: number;
  used: number;
  pending: number;
  /** What can be booked now: opening + accrued − used − pending, rounded DOWN
   * to a half day (leave is booked in 0.5 steps). The remainder is not lost:
   * accrual stays exact, so it shows up once it adds to another half day. */
  available: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Rounds DOWN to a half day: 0.83 → 0.5, 1.67 → 1.5, 2 → 2. The epsilon
 * keeps an exact half (computed as 1.4999999…) from dropping a step. */
export function bookableDays(n: number): number {
  return Math.floor(n * 2 + 1e-9) / 2;
}

function annualFor(policy: BalancePolicy, year: number): number {
  return policy.overrides.get(year) ?? policy.annualEntitlement;
}

/**
 * A month earns its 1/12 credit when the employee is employed during it: they
 * have joined by its last day and have not left before its first day. A
 * joiner gets the credit for their joining month, not a pro-rated share.
 */
function creditedMonths(policy: BalancePolicy, year: number): boolean[] {
  return Array.from({ length: 12 }, (_, i) => {
    const first = formatDateOnly(new Date(Date.UTC(year, i, 1)));
    const last = formatDateOnly(new Date(Date.UTC(year, i + 1, 0)));
    const joined = policy.joiningDate <= last;
    const notGone = policy.exitDate === null || policy.exitDate >= first;
    return joined && notGone;
  });
}

function creditedCount(policy: BalancePolicy, year: number, upTo = 12) {
  return creditedMonths(policy, year).slice(0, upTo).filter(Boolean).length;
}

/**
 * Balance of one leave type for one employee in `year`, as of `throughMonth`
 * (1–12). Carry-forward is computed year by year from the leave type's first
 * year, so it is deterministic from the full history. Unused days at year end
 * are carried up to `carryForwardLimit`; the rest is forfeited. Negative
 * closing balances carry nothing.
 */
export function yearBalance(
  policy: BalancePolicy,
  facts: BalanceFacts,
  year: number,
  throughMonth: number,
): YearBalance {
  let opening = 0;
  for (let y = policy.typeFirstYear; y < year; y++) {
    const closing =
      opening +
      (annualFor(policy, y) / 12) * creditedCount(policy, y) -
      (facts.usedByYear.get(y) ?? 0);
    opening = Math.min(Math.max(round2(closing), 0), policy.carryForwardLimit);
  }
  const annual = annualFor(policy, year);
  const accrued =
    year < policy.typeFirstYear
      ? 0
      : round2((annual / 12) * creditedCount(policy, year, throughMonth));
  const used = facts.usedByYear.get(year) ?? 0;
  const pending = facts.pendingInYear;
  const openingR = round2(opening);
  return {
    year,
    opening: openingR,
    entitlement: round2(annual),
    accrued,
    used: round2(used),
    pending: round2(pending),
    available: bookableDays(round2(openingR + accrued - used - pending)),
  };
}

/** True when `days` fits in the available balance. Unpaid leave is not checked. */
export function covers(balance: YearBalance, days: number): boolean {
  return balance.available + 1e-9 >= days;
}

// ---- Approval routing ------------------------------------------------------

/** 1 = one approval; 2 = a first approval, then HR (`hr.leave.approve.all`). */
export const APPROVAL_LEVELS = [1, 2] as const;
export type ApprovalLevels = (typeof APPROVAL_LEVELS)[number];

/** Working days the team lead has for the first decision before HR may take
 * it instead (Docs/HR_LEAVE.md §6.1). */
export const TEAM_LEAD_WAIT_WORKING_DAYS = 2;

/** Working days strictly after `from` up to and including `to` (both
 * `YYYY-MM-DD`), per `isWorking` (the employee's calendar). */
export function workingDaysAfter(
  from: string,
  to: string,
  isWorking: (date: string) => boolean,
): number {
  if (to <= from) return 0;
  return eachDate(from, to).filter((d) => d !== from && isWorking(d)).length;
}

/** Who a PENDING request waits for: the first approver (the employee's team
 * lead, or a team lead's delegate - HR alone for a team lead's own request,
 * a team with no lead, or once the team lead has not decided within
 * `TEAM_LEAD_WAIT_WORKING_DAYS`) or, on a two-level request already approved
 * once, HR. */
export type AwaitingStage = "FIRST" | "HR";

export function awaitingStage(request: {
  status: string;
  approvalLevels: number;
  firstDecidedAt: Date | null;
}): AwaitingStage | null {
  if (request.status !== "PENDING") return null;
  return request.approvalLevels === 2 && request.firstDecidedAt !== null
    ? "HR"
    : "FIRST";
}

export interface ApprovalFacts {
  approvalLevels: number;
  firstDecidedAt: Date | null;
  firstDecidedBy: number | null;
  actorId: number;
  employeeUserId: number | null;
  requestedBy: number;
  /** The actor is the active delegate today of a lead of the employee's team
   * (the lead themself is covered by their team scope, `inScope`). */
  isManager: boolean;
  /** The actor's `hr.leave.approve` scope is team/all and covers the employee. */
  inScope: boolean;
  /** The actor's resolved `hr.leave.approve` level. */
  scopeLevel: "own" | "team" | "all";
  /** Only HR (`.all`) may give the first decision: the employee is a team lead,
   * or their team has no lead who can approve. */
  hrOnly: boolean;
  /** The team lead has not decided within `TEAM_LEAD_WAIT_WORKING_DAYS`
   * working days: HR may take the decision instead. */
  escalated: boolean;
  /** The actor holds `hr.leave.override` (Admin): their decision at HR's step
   * is recorded as an override and needs a reason. */
  canOverride: boolean;
}

export type ApprovalRefusal =
  | "NOT_VISIBLE"
  | "SELF"
  | "REQUESTER"
  | "HR_ONLY"
  | "AWAITING_TEAM_LEAD"
  | "AWAITING_HR"
  | "SAME_APPROVER";

export type ApprovalVerdict =
  | {
      ok: true;
      stage: 1 | 2;
      final: boolean;
      /** Decided at HR's step by an Admin (`hr.leave.override`): audited as
       * an override, a reason is required and HR is told. */
      override: boolean;
    }
  | { ok: false; reason: ApprovalRefusal };

/**
 * Whether the actor may decide this PENDING request now, and at which stage.
 *
 *  - Nobody who is not the team's lead (or a lead's delegate) and outside
 *    their approve scope sees the request at all (NOT_VISIBLE → 404).
 *  - Nobody decides their own request, nor one they submitted on someone's
 *    behalf (maker-checker).
 *  - Stage 1 is the team lead's: the employee's team lead (team scope over
 *    the employee) or a lead's delegate. HR (`.all`) does not take it while
 *    the team lead still may.
 *  - HR (`.all`) alone - and finally, even on a two-level type - when the
 *    employee is a team lead, their team has no lead, or the team lead has
 *    not decided within `TEAM_LEAD_WAIT_WORKING_DAYS` (escalated).
 *  - Stage 2 (two-level only): an `.all` approver who did not give stage 1.
 *  - Any decision at HR's step by an Admin (`hr.leave.override`) is an
 *    override: allowed at any time, audited, reason required.
 */
export function approvalVerdict(f: ApprovalFacts): ApprovalVerdict {
  const hrInScope = f.inScope && f.scopeLevel === "all";
  const firstDone = f.approvalLevels === 2 && f.firstDecidedAt !== null;
  if (!f.isManager && !f.inScope) return { ok: false, reason: "NOT_VISIBLE" };
  if (f.employeeUserId !== null && f.employeeUserId === f.actorId)
    return { ok: false, reason: "SELF" };
  if (f.requestedBy === f.actorId) return { ok: false, reason: "REQUESTER" };
  if (!firstDone) {
    // No team-lead step exists here, so HR's one decision is the whole review.
    if (f.hrOnly) {
      return hrInScope
        ? { ok: true, stage: 1, final: true, override: f.canOverride }
        : { ok: false, reason: "HR_ONLY" };
    }
    // The team lead's step: the lead (team scope) or a lead's delegate.
    if (f.isManager || (f.inScope && f.scopeLevel !== "all")) {
      return {
        ok: true,
        stage: 1,
        final: f.approvalLevels !== 2,
        override: false,
      };
    }
    // Only an `.all` approver is left. The team lead had their time: HR's one
    // decision replaces both steps.
    if (f.escalated) {
      return { ok: true, stage: 1, final: true, override: f.canOverride };
    }
    return { ok: false, reason: "AWAITING_TEAM_LEAD" };
  }
  if (!hrInScope) return { ok: false, reason: "AWAITING_HR" };
  if (f.firstDecidedBy === f.actorId)
    return { ok: false, reason: "SAME_APPROVER" };
  return { ok: true, stage: 2, final: true, override: f.canOverride };
}

/** First day of every calendar month the inclusive range touches. */
export function monthsTouched(start: string, end: string): string[] {
  const out: string[] = [];
  let y = Number(start.slice(0, 4));
  let m = Number(start.slice(5, 7));
  const lastY = Number(end.slice(0, 4));
  const lastM = Number(end.slice(5, 7));
  while (y < lastY || (y === lastY && m <= lastM)) {
    out.push(`${y}-${String(m).padStart(2, "0")}-01`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}
