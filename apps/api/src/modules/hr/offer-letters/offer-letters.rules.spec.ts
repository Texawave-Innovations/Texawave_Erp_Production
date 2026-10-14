import { addDays, defaultValidityDate } from "./offer-letters.rules.js";

const utc = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m - 1, d));

describe("offer letter dates (legacy validity = today + 7 days)", () => {
  it("adds whole days within a month", () => {
    expect(addDays(utc(2026, 10, 5), 7)).toBe("2026-10-12");
  });

  it("crosses a month boundary", () => {
    expect(addDays(utc(2026, 10, 28), 7)).toBe("2026-11-04");
  });

  it("crosses a year boundary", () => {
    expect(addDays(utc(2026, 12, 28), 7)).toBe("2027-01-04");
  });

  it("defaults the validity to seven days after the given date", () => {
    expect(defaultValidityDate(utc(2026, 10, 5))).toBe("2026-10-12");
  });
});
