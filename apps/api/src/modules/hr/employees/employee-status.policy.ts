import { InvalidStateTransitionException } from "../../../common/exceptions/business.exception.js";

/** The four approved employment statuses (mirrored by a DB CHECK). */
export const EMPLOYEE_STATUSES = [
  "ACTIVE",
  "INACTIVE",
  "RESIGNED",
  "TERMINATED",
] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

/** Statuses meaning "has left the organization" — terminal in normal
 * operation. They carry an exit date and reason (DB CHECK). */
export const EXIT_STATUSES: readonly EmployeeStatus[] = [
  "RESIGNED",
  "TERMINATED",
];

export function isExitStatus(status: EmployeeStatus): boolean {
  return EXIT_STATUSES.includes(status);
}

/**
 * Normal lifecycle. RESIGNED and TERMINATED are terminal: nothing leaves
 * them here — a wrongly recorded exit is fixed only through the separate,
 * separately-permissioned, reason-mandatory correction workflow below.
 *
 * INACTIVE is "not currently working, but has not left" (e.g. a career
 * break); the person can be reactivated or later exit.
 */
export const TRANSITIONS: Readonly<
  Record<EmployeeStatus, readonly EmployeeStatus[]>
> = {
  ACTIVE: ["INACTIVE", "RESIGNED", "TERMINATED"],
  INACTIVE: ["ACTIVE", "RESIGNED", "TERMINATED"],
  RESIGNED: [],
  TERMINATED: [],
};

/**
 * Correction workflow — the only way out of a terminal state. Two kinds of
 * mistake are correctable: an exit recorded in error (reinstate to ACTIVE) and
 * an exit recorded under the wrong reason (RESIGNED ↔ TERMINATED). Correcting
 * a non-terminal status is not a "correction" — use the normal transition.
 */
export const CORRECTIONS: Readonly<
  Record<EmployeeStatus, readonly EmployeeStatus[]>
> = {
  ACTIVE: [],
  INACTIVE: [],
  RESIGNED: ["ACTIVE", "TERMINATED"],
  TERMINATED: ["ACTIVE", "RESIGNED"],
};

export function canTransition(
  from: EmployeeStatus,
  to: EmployeeStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function canCorrect(from: EmployeeStatus, to: EmployeeStatus): boolean {
  return CORRECTIONS[from].includes(to);
}

export function assertTransition(
  from: EmployeeStatus,
  to: EmployeeStatus,
): void {
  if (from === to) {
    throw new InvalidStateTransitionException(
      "Employee",
      from,
      to,
      "already in that status",
    );
  }
  if (!canTransition(from, to)) {
    throw new InvalidStateTransitionException(
      "Employee",
      from,
      to,
      isExitStatus(from)
        ? `${from} is a terminal status; only the audited status-correction workflow can change it`
        : undefined,
    );
  }
}

export function assertCorrection(
  from: EmployeeStatus,
  to: EmployeeStatus,
): void {
  if (!canCorrect(from, to)) {
    throw new InvalidStateTransitionException(
      "Employee",
      from,
      to,
      isExitStatus(from)
        ? `a ${from} employee can be corrected to ${CORRECTIONS[from].join(" or ")} only`
        : "corrections apply only to RESIGNED or TERMINATED employees — use a normal status change",
    );
  }
}
