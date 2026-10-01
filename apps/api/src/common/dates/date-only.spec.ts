import { validate } from "class-validator";
import {
  IsDateOnly,
  formatDateOnly,
  inclusiveDays,
  isDateOnlyString,
  parseDateOnly,
} from "./date-only.js";

describe("isDateOnlyString", () => {
  it.each(["2026-09-30", "2024-02-29", "1900-01-01", "2026-12-31"])(
    "accepts %s",
    (v) => expect(isDateOnlyString(v)).toBe(true),
  );

  it.each([
    "2026-02-30", // does not exist
    "2025-02-29", // not a leap year
    "2026-13-01",
    "2026-00-10",
    "2026-09-31",
    "0000-01-01",
    "1899-12-31",
    "2026-9-3",
    "26-09-30",
    "2026/09/30",
    "2026-09-30T00:00:00Z",
    " 2026-09-30",
    "",
    null,
    undefined,
    20260930,
    new Date(),
  ])("rejects %j", (v) => expect(isDateOnlyString(v)).toBe(false));
});

describe("parseDateOnly / formatDateOnly", () => {
  it("round-trips at UTC midnight regardless of the machine's time zone", () => {
    const d = parseDateOnly("2026-03-08");
    expect(d.toISOString()).toBe("2026-03-08T00:00:00.000Z");
    expect(formatDateOnly(d)).toBe("2026-03-08");
  });

  it("throws on an invalid date", () => {
    expect(() => parseDateOnly("2026-02-30")).toThrow(/YYYY-MM-DD/);
  });
});

describe("inclusiveDays", () => {
  it("counts both ends", () => {
    expect(
      inclusiveDays(parseDateOnly("2026-09-30"), parseDateOnly("2026-09-30")),
    ).toBe(1);
    expect(
      inclusiveDays(parseDateOnly("2026-09-28"), parseDateOnly("2026-10-02")),
    ).toBe(5);
  });

  it("is not thrown off by a daylight-saving change (dates carry no zone)", () => {
    expect(
      inclusiveDays(parseDateOnly("2026-03-07"), parseDateOnly("2026-03-09")),
    ).toBe(3);
    expect(
      inclusiveDays(parseDateOnly("2026-10-31"), parseDateOnly("2026-11-02")),
    ).toBe(3);
  });
});

describe("@IsDateOnly()", () => {
  class Probe {
    @IsDateOnly()
    on!: string;
  }
  it("validates through class-validator with a helpful message", async () => {
    const ok = Object.assign(new Probe(), { on: "2026-09-30" });
    expect(await validate(ok)).toHaveLength(0);
    const bad = Object.assign(new Probe(), { on: "2026-02-30" });
    const errors = await validate(bad);
    expect(errors).toHaveLength(1);
    expect(Object.values(errors[0]?.constraints ?? {})[0]).toMatch(
      /YYYY-MM-DD/,
    );
  });
});
