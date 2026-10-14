import {
  CorrectionNotApplicableException,
  planCorrection,
  type CorrectionRequest,
  type ExistingSession,
} from "./attendance-correction-planner.js";

const DAY = "2026-10-05";
const t = (hhmm: string) => new Date(`${DAY}T${hhmm}:00+05:30`);
const closed = (id: number, inH: string, outH: string): ExistingSession => ({
  id,
  checkInAt: t(inH),
  checkOutAt: t(outH),
});
const open = (id: number, inH: string): ExistingSession => ({
  id,
  checkInAt: t(inH),
  checkOutAt: null,
});
const req = (over: Partial<CorrectionRequest>): CorrectionRequest => ({
  attendanceDate: DAY,
  correctionType: "INCORRECT_TIME",
  requestedCheckInAt: null,
  requestedCheckOutAt: null,
  ...over,
});

describe("planCorrection", () => {
  it("MISSED_CHECK_IN creates the first session when the day has none", () => {
    const plan = planCorrection(
      req({
        correctionType: "MISSED_CHECK_IN",
        requestedCheckInAt: t("10:00"),
        requestedCheckOutAt: t("18:00"),
      }),
      [],
    );
    expect(plan.creates).toEqual([
      { checkInAt: t("10:00"), checkOutAt: t("18:00") },
    ]);
    expect(plan.updates).toEqual([]);
  });

  it("MISSED_CHECK_IN is refused when the day already has a check-in", () => {
    expect(() =>
      planCorrection(
        req({
          correctionType: "MISSED_CHECK_IN",
          requestedCheckInAt: t("10:00"),
        }),
        [closed(1, "09:00", "18:00")],
      ),
    ).toThrow(CorrectionNotApplicableException);
  });

  it("MISSED_CHECK_OUT closes the single open session", () => {
    const plan = planCorrection(
      req({
        correctionType: "MISSED_CHECK_OUT",
        requestedCheckOutAt: t("18:00"),
      }),
      [open(7, "10:00")],
    );
    expect(plan.updates).toEqual([{ id: 7, checkOutAt: t("18:00") }]);
  });

  it("MISSED_CHECK_OUT is refused when no session is open — no checkout is fabricated", () => {
    expect(() =>
      planCorrection(
        req({
          correctionType: "MISSED_CHECK_OUT",
          requestedCheckOutAt: t("18:00"),
        }),
        [closed(1, "10:00", "11:00")],
      ),
    ).toThrow(CorrectionNotApplicableException);
  });

  it("LATE_ARRIVAL moves the first check-in only", () => {
    const plan = planCorrection(
      req({ correctionType: "LATE_ARRIVAL", requestedCheckInAt: t("10:00") }),
      [closed(1, "10:30", "18:00")],
    );
    expect(plan.updates).toEqual([{ id: 1, checkInAt: t("10:00") }]);
  });

  it("LATE_ARRIVAL rejects a check-out change", () => {
    expect(() =>
      planCorrection(
        req({
          correctionType: "LATE_ARRIVAL",
          requestedCheckOutAt: t("18:00"),
        }),
        [closed(1, "10:30", "17:00")],
      ),
    ).toThrow(CorrectionNotApplicableException);
  });

  it("EARLY_DEPARTURE moves the last check-out only", () => {
    const plan = planCorrection(
      req({
        correctionType: "EARLY_DEPARTURE",
        requestedCheckOutAt: t("17:00"),
      }),
      [closed(1, "10:00", "13:00"), closed(2, "14:00", "18:00")],
    );
    expect(plan.updates).toEqual([{ id: 2, checkOutAt: t("17:00") }]);
  });

  it("INCORRECT_TIME may move both the first check-in and the last check-out", () => {
    const plan = planCorrection(
      req({ requestedCheckInAt: t("09:30"), requestedCheckOutAt: t("18:30") }),
      [closed(1, "10:00", "13:00"), closed(2, "14:00", "18:00")],
    );
    expect(plan.updates).toEqual([
      { id: 1, checkInAt: t("09:30") },
      { id: 2, checkOutAt: t("18:30") },
    ]);
  });

  it("a single-session day is handled as one punch, not two updates", () => {
    const plan = planCorrection(
      req({ requestedCheckInAt: t("09:30"), requestedCheckOutAt: t("18:30") }),
      [closed(1, "10:00", "18:00")],
    );
    expect(plan.updates).toEqual([
      { id: 1, checkInAt: t("09:30"), checkOutAt: t("18:30") },
    ]);
  });

  it("refuses a requested time outside the attendance date in IST", () => {
    // 00:10 IST on the 6th is 18:40 UTC on the 5th: the UTC date is wrong, IST is the business date.
    expect(() =>
      planCorrection(
        req({
          correctionType: "MISSED_CHECK_IN",
          requestedCheckInAt: new Date("2026-10-06T00:10:00+05:30"),
        }),
        [],
      ),
    ).toThrow(CorrectionNotApplicableException);
  });

  it("refuses a change that would make a session end before it starts", () => {
    expect(() =>
      planCorrection(
        req({ correctionType: "LATE_ARRIVAL", requestedCheckInAt: t("19:00") }),
        [closed(1, "10:00", "18:00")],
      ),
    ).toThrow(CorrectionNotApplicableException);
  });

  it("refuses a request with no time at all", () => {
    expect(() =>
      planCorrection(req({}), [closed(1, "10:00", "18:00")]),
    ).toThrow(CorrectionNotApplicableException);
  });

  it("refuses an unknown correction type", () => {
    expect(() =>
      planCorrection(
        req({ correctionType: "NOPE", requestedCheckInAt: t("10:00") }),
        [],
      ),
    ).toThrow(CorrectionNotApplicableException);
  });
});
