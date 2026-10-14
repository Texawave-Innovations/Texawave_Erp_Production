import {
  InvalidStateTransitionException,
  BusinessRuleViolationException,
} from "../../../common/exceptions/business.exception.js";

export const TASK_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** The slice of a task the lifecycle rules read. */
export interface TaskState {
  status: TaskStatus;
  adminApproved: boolean;
}

const IST_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The organization's current calendar day (IST), `YYYY-MM-DD`. Same business
 * day boundary as attendance (attendance-calculation.service.ts `istDateOf`);
 * copied rather than imported so this module does not depend on attendance. */
export function istToday(now: Date = new Date()): string {
  return IST_DATE.format(now);
}

/** Legacy rule: not finished (DONE/CANCELLED) and due before today. */
export function isOverdue(
  status: TaskStatus,
  dueDate: string,
  today: string,
): boolean {
  return status !== "DONE" && status !== "CANCELLED" && dueDate < today;
}

/** A DONE task that admin has not yet approved (legacy "Awaiting Approval"). */
export function isAwaitingApproval(state: TaskState): boolean {
  return state.status === "DONE" && !state.adminApproved;
}

/** Legacy create forms set the date picker's `min` to today. The browser only
 * enforces that on the picker, so it is enforced here as well. */
export function assertDueDateNotPast(dueDate: string, today: string): void {
  if (dueDate < today) {
    throw new BusinessRuleViolationException(
      "Due date cannot be in the past",
      "DUE_DATE_IN_PAST",
    );
  }
}

/**
 * Admin status set (legacy: the status dropdown, shown only while the task is
 * not approved and not awaiting approval). Returns `true` when the task is
 * already in `target` (a no-op the caller should answer without writing).
 *
 * A DONE task leaves that state only through approve or reopen, never through
 * this dropdown. An approved task is final for this endpoint.
 */
export function assertAdminStatusChange(
  state: TaskState,
  target: TaskStatus,
): boolean {
  if (state.adminApproved) {
    throw new InvalidStateTransitionException(
      "Task",
      state.status,
      target,
      "an approved task is final",
    );
  }
  if (state.status === "DONE") {
    throw new InvalidStateTransitionException(
      "Task",
      state.status,
      target,
      "a completed task must be approved or reopened",
    );
  }
  return state.status === target;
}

/**
 * Employee self-service moves, exactly the legacy controls: "Start Working"
 * (PENDING → IN_PROGRESS), "Mark as Done" (PENDING/IN_PROGRESS → DONE), and
 * the checkbox toggle that reopens a DONE task to PENDING. A task is locked to
 * the employee once admin approves it, and a CANCELLED task cannot be touched.
 */
const EMPLOYEE_MOVES: Record<TaskStatus, readonly TaskStatus[]> = {
  PENDING: ["IN_PROGRESS", "DONE"],
  IN_PROGRESS: ["DONE"],
  DONE: ["PENDING"],
  CANCELLED: [],
};

export function assertEmployeeStatusChange(
  state: TaskState,
  target: TaskStatus,
): void {
  if (state.adminApproved) {
    throw new InvalidStateTransitionException(
      "Task",
      state.status,
      target,
      "the task was approved by admin and is locked",
    );
  }
  if (!EMPLOYEE_MOVES[state.status].includes(target)) {
    throw new InvalidStateTransitionException("Task", state.status, target);
  }
}

/** Only open, admin-assigned work may change hands. */
export function assertReassignable(
  state: TaskState,
  isEmployeeCreated: boolean,
): void {
  if (isEmployeeCreated) {
    throw new BusinessRuleViolationException(
      "An employee-created task belongs to the employee and cannot be reassigned",
      "EMPLOYEE_CREATED_TASK_NOT_REASSIGNABLE",
    );
  }
  if (state.status !== "PENDING" && state.status !== "IN_PROGRESS") {
    throw new BusinessRuleViolationException(
      "Only a pending or in-progress task can be reassigned",
      "TASK_NOT_REASSIGNABLE",
    );
  }
}

/** Approve needs a completed task that is not yet approved (legacy: the
 * Approve button appears only for DONE tasks awaiting approval). */
export function assertApprovable(state: TaskState): void {
  if (state.adminApproved) {
    throw new InvalidStateTransitionException(
      "Task",
      state.status,
      "APPROVED",
      "already approved",
    );
  }
  if (state.status !== "DONE") {
    throw new InvalidStateTransitionException(
      "Task",
      state.status,
      "APPROVED",
      "only a completed task can be approved",
    );
  }
}

/** Reopen returns an unapproved DONE task to IN_PROGRESS (legacy "Reopen"). */
export function assertReopenable(state: TaskState): void {
  if (!isAwaitingApproval(state)) {
    throw new InvalidStateTransitionException(
      "Task",
      state.status,
      "IN_PROGRESS",
      "only a completed task awaiting approval can be reopened",
    );
  }
}
