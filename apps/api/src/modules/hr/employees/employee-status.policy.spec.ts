import { InvalidStateTransitionException } from "../../../common/exceptions/business.exception.js";
import {
  CORRECTIONS,
  EMPLOYEE_STATUSES,
  EXIT_STATUSES,
  TRANSITIONS,
  assertCorrection,
  assertTransition,
  canCorrect,
  canTransition,
  isExitStatus,
  type EmployeeStatus,
} from "./employee-status.policy.js";

const pairs = EMPLOYEE_STATUSES.flatMap((from) =>
  EMPLOYEE_STATUSES.map((to) => [from, to] as [EmployeeStatus, EmployeeStatus]),
);

describe("employee status policy", () => {
  it("knows exactly the four approved statuses", () => {
    expect([...EMPLOYEE_STATUSES]).toEqual([
      "ACTIVE",
      "INACTIVE",
      "RESIGNED",
      "TERMINATED",
    ]);
    expect([...EXIT_STATUSES]).toEqual(["RESIGNED", "TERMINATED"]);
  });

  it("has an entry for every status in both tables (no silent gaps)", () => {
    for (const s of EMPLOYEE_STATUSES) {
      expect(TRANSITIONS[s]).toBeDefined();
      expect(CORRECTIONS[s]).toBeDefined();
    }
  });

  describe("normal transitions", () => {
    const allowed: Array<[EmployeeStatus, EmployeeStatus]> = [
      ["ACTIVE", "INACTIVE"],
      ["ACTIVE", "RESIGNED"],
      ["ACTIVE", "TERMINATED"],
      ["INACTIVE", "ACTIVE"],
      ["INACTIVE", "RESIGNED"],
      ["INACTIVE", "TERMINATED"],
    ];

    it.each(allowed)("allows %s → %s", (from, to) => {
      expect(canTransition(from, to)).toBe(true);
      expect(() => assertTransition(from, to)).not.toThrow();
    });

    it("allows nothing else — every other pair is rejected", () => {
      const rejected = pairs.filter(
        ([f, t]) => !allowed.some(([af, at]) => af === f && at === t),
      );
      expect(rejected).toHaveLength(16 - allowed.length);
      for (const [from, to] of rejected) {
        expect(canTransition(from, to)).toBe(false);
        expect(() => assertTransition(from, to)).toThrow(
          InvalidStateTransitionException,
        );
      }
    });

    it.each(EXIT_STATUSES)(
      "%s is terminal: no normal transition leaves it",
      (from) => {
        for (const to of EMPLOYEE_STATUSES) {
          expect(canTransition(from, to)).toBe(false);
        }
        expect(() => assertTransition(from, "ACTIVE")).toThrow(/terminal/);
      },
    );

    it("rejects a no-op move with a clear message", () => {
      expect(() => assertTransition("ACTIVE", "ACTIVE")).toThrow(
        /already in that status/,
      );
    });

    it("throws a 422 INVALID_STATE_TRANSITION", () => {
      try {
        assertTransition("TERMINATED", "ACTIVE");
        throw new Error("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(InvalidStateTransitionException);
        const ex = e as InvalidStateTransitionException;
        expect(ex.getStatus()).toBe(422);
        expect(ex.errorCode).toBe("INVALID_STATE_TRANSITION");
      }
    });
  });

  describe("correction workflow", () => {
    const allowed: Array<[EmployeeStatus, EmployeeStatus]> = [
      ["RESIGNED", "ACTIVE"],
      ["RESIGNED", "TERMINATED"],
      ["TERMINATED", "ACTIVE"],
      ["TERMINATED", "RESIGNED"],
    ];
    it.each(allowed)("allows correcting %s → %s", (from, to) => {
      expect(canCorrect(from, to)).toBe(true);
      expect(() => assertCorrection(from, to)).not.toThrow();
    });

    it("rejects every other pair, including reinstating to INACTIVE and no-op corrections", () => {
      const rejected = pairs.filter(
        ([f, t]) => !allowed.some(([af, at]) => af === f && at === t),
      );
      for (const [from, to] of rejected) {
        expect(() => assertCorrection(from, to)).toThrow(
          InvalidStateTransitionException,
        );
      }
      expect(canCorrect("RESIGNED", "INACTIVE")).toBe(false);
      expect(canCorrect("RESIGNED", "RESIGNED")).toBe(false);
    });

    it("does not treat non-terminal statuses as correctable", () => {
      expect(() => assertCorrection("ACTIVE", "INACTIVE")).toThrow(
        /use a normal status change/,
      );
    });

    it("never overlaps with the normal table: a correction is never also a normal transition", () => {
      for (const [from, to] of pairs) {
        expect(canTransition(from, to) && canCorrect(from, to)).toBe(false);
      }
    });
  });

  it("isExitStatus identifies only the two leaving statuses", () => {
    expect(EMPLOYEE_STATUSES.filter(isExitStatus)).toEqual([
      "RESIGNED",
      "TERMINATED",
    ]);
  });
});
