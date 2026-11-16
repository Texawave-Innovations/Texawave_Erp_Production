import { describe, expect, it } from "vitest";
import {
  AUTO_CHECKOUT_TIME_PATTERN,
  DEFAULT_RULES,
  fixedCloseAt,
  planFixedCheckouts,
  toRules,
} from "./attendance-settings.rules.js";

// 2026-11-14 20:00 IST = 14:30 UTC.
const at = (iso: string) => new Date(iso);

describe("AUTO_CHECKOUT_TIME_PATTERN", () => {
  it.each(["00:00", "09:05", "20:00", "23:59"])("accepts %s", (v) => {
    expect(AUTO_CHECKOUT_TIME_PATTERN.test(v)).toBe(true);
  });
  it.each(["24:00", "9:05", "20:60", "20:00:00", "", "ab:cd"])(
    "rejects %s",
    (v) => {
      expect(AUTO_CHECKOUT_TIME_PATTERN.test(v)).toBe(false);
    },
  );
});

describe("toRules", () => {
  it("uses the defaults (off) before the first save", () => {
    expect(toRules(null)).toEqual(DEFAULT_RULES);
    expect(DEFAULT_RULES.autoCheckoutEnabled).toBe(false);
  });
  it("reads a saved row", () => {
    expect(
      toRules({ autoCheckoutEnabled: true, autoCheckoutTime: "19:30" }),
    ).toEqual({ autoCheckoutEnabled: true, autoCheckoutTime: "19:30" });
  });
});

describe("fixedCloseAt", () => {
  it("closes at the cut-off on the session's own date", () => {
    const out = fixedCloseAt(
      "2026-11-14",
      "20:00",
      at("2026-11-14T04:00:00.000Z"),
    );
    expect(out?.toISOString()).toBe("2026-11-14T14:30:00.000Z");
  });

  it("never runs into the next day", () => {
    const out = fixedCloseAt(
      "2026-11-14",
      "20:00",
      at("2026-11-14T04:00:00.000Z"),
    );
    expect(out!.getTime()).toBeLessThan(
      at("2026-11-14T18:30:00.000Z").getTime(), // 2026-11-15 00:00 IST
    );
  });

  it("closes a check-in after the cut-off at the last minute of the day", () => {
    // 21:00 IST check-in on 14 Nov.
    const out = fixedCloseAt(
      "2026-11-14",
      "20:00",
      at("2026-11-14T15:30:00.000Z"),
    );
    expect(out?.toISOString()).toBe("2026-11-14T18:29:00.000Z"); // 23:59 IST
  });

  it("leaves a check-in in the last minute of the day open", () => {
    const out = fixedCloseAt(
      "2026-11-14",
      "20:00",
      at("2026-11-14T18:29:30.000Z"), // 23:59:30 IST
    );
    expect(out).toBeNull();
  });
});

describe("planFixedCheckouts", () => {
  const stale = {
    id: 1,
    attendanceDate: "2026-11-14",
    checkInAt: at("2026-11-14T04:00:00.000Z"),
  };

  it("closes a forgotten session from a previous day at that day's cut-off", () => {
    const plan = planFixedCheckouts(
      [stale],
      "20:00",
      at("2026-11-16T03:10:00.000Z"),
    );
    expect(plan.closes).toEqual([
      { id: 1, checkOutAt: at("2026-11-14T14:30:00.000Z") },
    ]);
  });

  it("does not close a session before the cut-off today", () => {
    const today = {
      id: 2,
      attendanceDate: "2026-11-16",
      checkInAt: at("2026-11-16T04:00:00.000Z"),
    };
    const plan = planFixedCheckouts(
      [today],
      "20:00",
      at("2026-11-16T10:00:00.000Z"), // 15:30 IST
    );
    expect(plan.closes).toEqual([]);
    expect(plan.notDue).toBe(1);
  });

  it("closes today's session once the cut-off has passed", () => {
    const today = {
      id: 2,
      attendanceDate: "2026-11-16",
      checkInAt: at("2026-11-16T04:00:00.000Z"),
    };
    const plan = planFixedCheckouts(
      [today],
      "20:00",
      at("2026-11-16T14:31:00.000Z"),
    );
    expect(plan.closes).toEqual([
      { id: 2, checkOutAt: at("2026-11-16T14:30:00.000Z") },
    ]);
  });

  it("counts sessions that cannot be closed inside their day", () => {
    const plan = planFixedCheckouts(
      [{ ...stale, checkInAt: at("2026-11-14T18:29:30.000Z") }],
      "20:00",
      at("2026-11-16T03:10:00.000Z"),
    );
    expect(plan).toEqual({ closes: [], notDue: 0, unclosable: 1 });
  });
});
