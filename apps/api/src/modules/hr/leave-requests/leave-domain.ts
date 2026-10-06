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
  available: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

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
    available: round2(openingR + accrued - used - pending),
  };
}

/** True when `days` fits in the available balance. Unpaid leave is not checked. */
export function covers(balance: YearBalance, days: number): boolean {
  return balance.available + 1e-9 >= days;
}
