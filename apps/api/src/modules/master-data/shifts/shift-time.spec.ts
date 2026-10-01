import { BusinessRuleViolationException } from "../../../common/exceptions/business.exception.js";
import {
  TIME_PATTERN,
  assertShiftTimes,
  isOvernight,
  shiftSpanMinutes,
  timeToMinutes,
} from "./shift-time.js";

describe("timeToMinutes", () => {
  it.each([
    ["00:00", 0],
    ["09:30", 570],
    ["23:59", 1439],
  ])("%s → %i", (t, m) => expect(timeToMinutes(t)).toBe(m));

  it.each([
    "24:00",
    "9:30",
    "09:60",
    "0930",
    "09:30:00",
    "",
    "ab:cd",
    " 09:30",
  ])("rejects %j", (t) => {
    expect(() => timeToMinutes(t)).toThrow(BusinessRuleViolationException);
  });

  it("agrees with the pattern the database CHECK uses", () => {
    expect(TIME_PATTERN.test("23:59")).toBe(true);
    expect(TIME_PATTERN.test("24:00")).toBe(false);
  });
});

describe("overnight and span", () => {
  it.each([
    ["09:00", "18:00", false, 540],
    ["06:00", "14:00", false, 480],
    ["22:00", "06:00", true, 480],
    ["23:30", "00:30", true, 60],
    ["00:00", "23:59", false, 1439],
    ["12:00", "11:59", true, 1439],
  ])("%s–%s overnight=%s span=%i", (s, e, overnight, span) => {
    expect(isOvernight(s, e)).toBe(overnight);
    expect(shiftSpanMinutes(s, e)).toBe(span);
  });
});

describe("assertShiftTimes", () => {
  const ok = (startTime: string, endTime: string, workingMinutes: number) =>
    assertShiftTimes({ startTime, endTime, workingMinutes });
  const codeOf = (fn: () => unknown) => {
    try {
      fn();
    } catch (e) {
      return (e as BusinessRuleViolationException).errorCode;
    }
    return undefined;
  };

  it("accepts a day shift and derives overnight=false", () => {
    expect(ok("09:00", "18:00", 480)).toEqual({ isOvernight: false });
    expect(ok("09:00", "18:00", 540)).toEqual({ isOvernight: false }); // exactly the window
  });

  it("accepts an overnight shift and derives overnight=true", () => {
    expect(ok("22:00", "06:00", 450)).toEqual({ isOvernight: true });
    expect(ok("23:00", "07:00", 480)).toEqual({ isOvernight: true });
  });

  it("refuses equal start and end", () => {
    expect(codeOf(() => ok("09:00", "09:00", 60))).toBe("SHIFT_TIME_INVALID");
    expect(codeOf(() => ok("00:00", "00:00", 60))).toBe("SHIFT_TIME_INVALID");
  });

  it("refuses malformed times", () => {
    expect(codeOf(() => ok("9:00", "18:00", 60))).toBe("SHIFT_TIME_INVALID");
    expect(codeOf(() => ok("09:00", "25:00", 60))).toBe("SHIFT_TIME_INVALID");
  });

  it.each([0, -5, 1.5, Number.NaN])("refuses working minutes %s", (m) => {
    expect(codeOf(() => ok("09:00", "18:00", m))).toBe(
      "SHIFT_WORKING_MINUTES_INVALID",
    );
  });

  it("refuses a working duration longer than the window — including across midnight", () => {
    expect(codeOf(() => ok("09:00", "18:00", 541))).toBe(
      "SHIFT_WORKING_MINUTES_INVALID",
    );
    expect(codeOf(() => ok("22:00", "06:00", 481))).toBe(
      "SHIFT_WORKING_MINUTES_INVALID",
    );
  });

  it("returns a 422", () => {
    try {
      ok("09:00", "09:00", 60);
    } catch (e) {
      expect((e as BusinessRuleViolationException).getStatus()).toBe(422);
    }
  });
});
