import {
  BusinessRuleViolationException,
  InvalidStateTransitionException,
} from "../../../common/exceptions/business.exception.js";
import {
  assertAdminStatusChange,
  assertApprovable,
  assertDueDateNotPast,
  assertEmployeeStatusChange,
  assertReassignable,
  assertReopenable,
  isAwaitingApproval,
  isOverdue,
  istToday,
} from "./tasks.rules.js";

const open = { status: "PENDING", adminApproved: false } as const;
const doneAwaiting = { status: "DONE", adminApproved: false } as const;
const approved = { status: "DONE", adminApproved: true } as const;

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return (e as { errorCode?: string }).errorCode;
  }
  return undefined;
}

describe("tasks.rules: due dates and overdue", () => {
  it("rejects a due date before today", () => {
    expect(() => assertDueDateNotPast("2026-10-05", "2026-10-06")).toThrow(
      BusinessRuleViolationException,
    );
    expect(codeOf(() => assertDueDateNotPast("2026-10-05", "2026-10-06"))).toBe(
      "DUE_DATE_IN_PAST",
    );
  });

  it("accepts today and future dates", () => {
    expect(() =>
      assertDueDateNotPast("2026-10-06", "2026-10-06"),
    ).not.toThrow();
    expect(() =>
      assertDueDateNotPast("2026-12-31", "2026-10-06"),
    ).not.toThrow();
  });

  it("overdue is a past due date that is not DONE or CANCELLED (legacy rule)", () => {
    expect(isOverdue("PENDING", "2026-10-05", "2026-10-06")).toBe(true);
    expect(isOverdue("IN_PROGRESS", "2026-10-05", "2026-10-06")).toBe(true);
    expect(isOverdue("DONE", "2026-10-05", "2026-10-06")).toBe(false);
    expect(isOverdue("CANCELLED", "2026-10-05", "2026-10-06")).toBe(false);
    expect(isOverdue("PENDING", "2026-10-06", "2026-10-06")).toBe(false);
  });

  it("'today' is the Asia/Kolkata calendar day, not the UTC day", () => {
    // 2026-10-05T19:00Z is already 2026-10-06 00:30 in IST.
    expect(istToday(new Date("2026-10-05T19:00:00Z"))).toBe("2026-10-06");
    expect(istToday(new Date("2026-10-05T17:00:00Z"))).toBe("2026-10-05");
  });
});

describe("tasks.rules: admin status set", () => {
  it("allows PENDING/IN_PROGRESS/CANCELLED to move among each other and to DONE", () => {
    expect(assertAdminStatusChange(open, "IN_PROGRESS")).toBe(false);
    expect(assertAdminStatusChange(open, "CANCELLED")).toBe(false);
    expect(assertAdminStatusChange(open, "DONE")).toBe(false);
    expect(
      assertAdminStatusChange(
        { status: "CANCELLED", adminApproved: false },
        "PENDING",
      ),
    ).toBe(false);
  });

  it("reports a no-op when the status is unchanged", () => {
    expect(assertAdminStatusChange(open, "PENDING")).toBe(true);
  });

  it("refuses to move a DONE task through the dropdown (approve or reopen instead)", () => {
    expect(() => assertAdminStatusChange(doneAwaiting, "PENDING")).toThrow(
      InvalidStateTransitionException,
    );
  });

  it("refuses any change to an approved task", () => {
    expect(() => assertAdminStatusChange(approved, "PENDING")).toThrow(
      InvalidStateTransitionException,
    );
  });
});

describe("tasks.rules: employee self-service status", () => {
  it.each([
    ["PENDING", "IN_PROGRESS"], // Start Working
    ["PENDING", "DONE"], // Mark as Done
    ["IN_PROGRESS", "DONE"], // Mark as Done
    ["DONE", "PENDING"], // checkbox toggle reopens an unapproved task
  ] as const)("allows %s -> %s", (from, to) => {
    expect(() =>
      assertEmployeeStatusChange({ status: from, adminApproved: false }, to),
    ).not.toThrow();
  });

  it.each([
    ["IN_PROGRESS", "PENDING"],
    ["PENDING", "CANCELLED"], // cancel is admin-only
    ["CANCELLED", "PENDING"],
    ["DONE", "IN_PROGRESS"],
  ] as const)("refuses %s -> %s", (from, to) => {
    expect(() =>
      assertEmployeeStatusChange({ status: from, adminApproved: false }, to),
    ).toThrow(InvalidStateTransitionException);
  });

  it("locks every task once admin approved it", () => {
    expect(() => assertEmployeeStatusChange(approved, "PENDING")).toThrow(
      InvalidStateTransitionException,
    );
  });
});

describe("tasks.rules: approval, reopen, reassignment", () => {
  it("approve needs a DONE, unapproved task", () => {
    expect(() => assertApprovable(doneAwaiting)).not.toThrow();
    expect(() => assertApprovable(open)).toThrow(
      InvalidStateTransitionException,
    );
    expect(() => assertApprovable(approved)).toThrow(
      InvalidStateTransitionException,
    );
  });

  it("reopen needs a DONE, unapproved task and returns to IN_PROGRESS", () => {
    expect(() => assertReopenable(doneAwaiting)).not.toThrow();
    expect(() => assertReopenable(open)).toThrow(
      InvalidStateTransitionException,
    );
    expect(() => assertReopenable(approved)).toThrow(
      InvalidStateTransitionException,
    );
  });

  it("awaiting approval is DONE and not yet approved", () => {
    expect(isAwaitingApproval(doneAwaiting)).toBe(true);
    expect(isAwaitingApproval(approved)).toBe(false);
    expect(isAwaitingApproval(open)).toBe(false);
  });

  it("only open, admin-assigned tasks can be reassigned", () => {
    expect(() => assertReassignable(open, false)).not.toThrow();
    expect(() =>
      assertReassignable(
        { status: "IN_PROGRESS", adminApproved: false },
        false,
      ),
    ).not.toThrow();
    expect(() =>
      assertReassignable({ status: "DONE", adminApproved: false }, false),
    ).toThrow(BusinessRuleViolationException);
    expect(() =>
      assertReassignable({ status: "CANCELLED", adminApproved: false }, false),
    ).toThrow(BusinessRuleViolationException);
    expect(codeOf(() => assertReassignable(open, true))).toBe(
      "EMPLOYEE_CREATED_TASK_NOT_REASSIGNABLE",
    );
  });
});
