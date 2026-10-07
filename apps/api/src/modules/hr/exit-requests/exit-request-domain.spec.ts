import {
  ACTIVE_STATUSES,
  canTransition,
  EXIT_REQUEST_STATUSES,
  type ExitRequestStatus,
  isActive,
  isDecision,
  isTerminal,
  TRANSITIONS,
} from "./exit-request-domain.js";

describe("exit request transition map", () => {
  it("allows the default lifecycle moves (PRODUCTION DECISION E1)", () => {
    expect(canTransition("SUBMITTED", "UNDER_REVIEW")).toBe(true);
    expect(canTransition("SUBMITTED", "APPROVED")).toBe(true);
    expect(canTransition("SUBMITTED", "REJECTED")).toBe(true);
    expect(canTransition("UNDER_REVIEW", "APPROVED")).toBe(true);
    expect(canTransition("UNDER_REVIEW", "REJECTED")).toBe(true);
    expect(canTransition("APPROVED", "COMPLETED")).toBe(true);
  });

  it.each([
    ["SUBMITTED", "COMPLETED"],
    ["UNDER_REVIEW", "SUBMITTED"],
    ["UNDER_REVIEW", "COMPLETED"],
    ["APPROVED", "REJECTED"],
    ["APPROVED", "APPROVED"],
    ["APPROVED", "SUBMITTED"],
    ["REJECTED", "APPROVED"],
    ["REJECTED", "UNDER_REVIEW"],
    ["COMPLETED", "APPROVED"],
    ["COMPLETED", "REJECTED"],
  ] as [ExitRequestStatus, ExitRequestStatus][])(
    "refuses %s -> %s",
    (from, to) => {
      expect(canTransition(from, to)).toBe(false);
    },
  );

  it("treats REJECTED and COMPLETED as final and nothing else", () => {
    expect(isTerminal("REJECTED")).toBe(true);
    expect(isTerminal("COMPLETED")).toBe(true);
    expect(isTerminal("SUBMITTED")).toBe(false);
    expect(isTerminal("UNDER_REVIEW")).toBe(false);
    expect(isTerminal("APPROVED")).toBe(false);
  });

  it("covers every status exactly once in the map", () => {
    expect(Object.keys(TRANSITIONS).sort()).toEqual(
      [...EXIT_REQUEST_STATUSES].sort(),
    );
  });

  it("matches legacy's active set: submitted, under review and approved", () => {
    expect([...ACTIVE_STATUSES].sort()).toEqual(
      ["APPROVED", "SUBMITTED", "UNDER_REVIEW"].sort(),
    );
    expect(isActive("APPROVED")).toBe(true);
    expect(isActive("REJECTED")).toBe(false);
    expect(isActive("COMPLETED")).toBe(false);
  });

  it("records a decision only for approval and rejection", () => {
    expect(isDecision("APPROVED")).toBe(true);
    expect(isDecision("REJECTED")).toBe(true);
    expect(isDecision("UNDER_REVIEW")).toBe(false);
    expect(isDecision("COMPLETED")).toBe(false);
  });
});
