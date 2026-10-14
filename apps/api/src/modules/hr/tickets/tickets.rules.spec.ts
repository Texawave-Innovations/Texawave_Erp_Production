import {
  BusinessRuleViolationException,
  InvalidStateTransitionException,
} from "../../../common/exceptions/business.exception.js";
import {
  assertAdminStatusChange,
  assertEmployeeCanReply,
  assertEmployeeCategory,
  assertEmployeeEditable,
  assertHrCanReply,
  isActive,
  isReopen,
  TICKET_STATUSES,
  type TicketStatus,
} from "./tickets.rules.js";

/** The stable error code a rule throws, or `undefined` when it does not throw. */
const codeOf = (fn: () => void): string | undefined => {
  try {
    fn();
    return undefined;
  } catch (e) {
    return (e as { errorCode?: string }).errorCode;
  }
};

const open = (raisedByAdmin = false) => ({
  status: "OPEN" as const,
  raisedByAdmin,
});
const at = (status: TicketStatus, raisedByAdmin = false) => ({
  status,
  raisedByAdmin,
});

/** Every admin move the lifecycle allows, written out so a change to the
 * table has to change this test too. */
const ALLOWED: Array<[TicketStatus, TicketStatus]> = [
  ["OPEN", "IN_PROGRESS"],
  ["OPEN", "RESOLVED"],
  ["OPEN", "CLOSED"],
  ["IN_PROGRESS", "OPEN"],
  ["IN_PROGRESS", "RESOLVED"],
  ["IN_PROGRESS", "CLOSED"],
  ["RESOLVED", "OPEN"],
  ["RESOLVED", "CLOSED"],
  ["CLOSED", "OPEN"],
];

describe("ticket admin status transitions", () => {
  it.each(ALLOWED)("%s -> %s is allowed and writes", (from, to) => {
    expect(assertAdminStatusChange(at(from), to)).toBe(false);
  });

  it.each(TICKET_STATUSES)("%s -> %s (same status) is a no-op", (status) => {
    expect(assertAdminStatusChange(at(status), status)).toBe(true);
  });

  it.each([
    ["RESOLVED", "IN_PROGRESS"],
    ["CLOSED", "IN_PROGRESS"],
    ["CLOSED", "RESOLVED"],
  ] as Array<[TicketStatus, TicketStatus]>)(
    "%s -> %s is rejected",
    (from, to) => {
      expect(() => assertAdminStatusChange(at(from), to)).toThrow(
        InvalidStateTransitionException,
      );
    },
  );

  it("every pair not in ALLOWED and not a no-op is rejected", () => {
    const allowed = new Set(ALLOWED.map(([f, t]) => `${f}>${t}`));
    for (const from of TICKET_STATUSES) {
      for (const to of TICKET_STATUSES) {
        if (from === to || allowed.has(`${from}>${to}`)) continue;
        expect(() => assertAdminStatusChange(at(from), to)).toThrow(
          InvalidStateTransitionException,
        );
      }
    }
  });
});

describe("isReopen", () => {
  it("is true only for a move back to OPEN from RESOLVED or CLOSED", () => {
    expect(isReopen("RESOLVED", "OPEN")).toBe(true);
    expect(isReopen("CLOSED", "OPEN")).toBe(true);
    expect(isReopen("IN_PROGRESS", "OPEN")).toBe(false);
    expect(isReopen("OPEN", "RESOLVED")).toBe(false);
  });
});

describe("employee edit", () => {
  it("allows an open, self-raised ticket", () => {
    expect(() => assertEmployeeEditable(open())).not.toThrow();
  });

  it("refuses a ticket HR raised, whatever its status", () => {
    expect(codeOf(() => assertEmployeeEditable(open(true)))).toBe(
      "ADMIN_RAISED_TICKET_NOT_EDITABLE",
    );
  });

  it.each(["IN_PROGRESS", "RESOLVED", "CLOSED"] as const)(
    "refuses a %s ticket",
    (status) => {
      expect(() => assertEmployeeEditable(at(status))).toThrow(
        BusinessRuleViolationException,
      );
    },
  );
});

describe("replies", () => {
  it.each(["OPEN", "IN_PROGRESS"] as const)(
    "HR may reply to a %s ticket",
    (status) => {
      expect(() => assertHrCanReply(at(status))).not.toThrow();
    },
  );

  it.each(["RESOLVED", "CLOSED"] as const)(
    "HR may not reply to a %s ticket",
    (status) => {
      expect(() => assertHrCanReply(at(status))).toThrow(
        BusinessRuleViolationException,
      );
    },
  );

  it("an employee may reply only on a ticket HR raised", () => {
    expect(() => assertEmployeeCanReply(open(true))).not.toThrow();
    expect(codeOf(() => assertEmployeeCanReply(open(false)))).toBe(
      "REPLY_NOT_ALLOWED",
    );
  });
});

describe("categories", () => {
  it.each([
    "Attendance",
    "Salary",
    "Leave",
    "Documents",
    "IT Support",
    "HR Query",
    "Other",
  ] as const)("an employee may raise %s", (c) => {
    expect(() => assertEmployeeCategory(c)).not.toThrow();
  });

  it.each(["Notice", "Warning"] as const)(
    "an employee may not raise %s (HR-only, legacy admin form)",
    (c) => {
      expect(codeOf(() => assertEmployeeCategory(c))).toBe(
        "CATEGORY_NOT_ALLOWED",
      );
    },
  );
});

describe("isActive", () => {
  it("is true only for OPEN and IN_PROGRESS", () => {
    expect(isActive("OPEN")).toBe(true);
    expect(isActive("IN_PROGRESS")).toBe(true);
    expect(isActive("RESOLVED")).toBe(false);
    expect(isActive("CLOSED")).toBe(false);
  });
});
