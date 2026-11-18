import { describe, expect, it } from "vitest";
import {
  checkDndRequest,
  DND_OFF,
  dndStateOf,
  MAX_SNOOZE_MS,
} from "./dnd.rules.js";

const NOW = new Date("2026-11-16T10:00:00Z");
const later = (ms: number) => new Date(NOW.getTime() + ms);

describe("dndStateOf", () => {
  it("is off with no preference row", () => {
    expect(dndStateOf(null, NOW)).toEqual(DND_OFF);
  });

  it("is active until a future time", () => {
    const until = later(30 * 60_000);
    expect(dndStateOf({ dndUntil: until, dndIndefinite: false }, NOW)).toEqual({
      active: true,
      until: until.toISOString(),
      indefinite: false,
    });
  });

  it("switches itself off once the time has passed", () => {
    expect(
      dndStateOf({ dndUntil: later(-1), dndIndefinite: false }, NOW),
    ).toEqual(DND_OFF);
    expect(dndStateOf({ dndUntil: NOW, dndIndefinite: false }, NOW)).toEqual(
      DND_OFF,
    );
  });

  it("stays active when indefinite", () => {
    expect(dndStateOf({ dndUntil: null, dndIndefinite: true }, NOW)).toEqual({
      active: true,
      until: null,
      indefinite: true,
    });
  });
});

describe("checkDndRequest", () => {
  it("accepts a timed snooze inside the limit", () => {
    expect(
      checkDndRequest({ until: later(60 * 60_000), indefinite: false }, NOW),
    ).toBeNull();
    expect(
      checkDndRequest({ until: later(MAX_SNOOZE_MS), indefinite: false }, NOW),
    ).toBeNull();
  });

  it("accepts indefinite and off", () => {
    expect(checkDndRequest({ until: null, indefinite: true }, NOW)).toBeNull();
    expect(checkDndRequest({ until: null, indefinite: false }, NOW)).toBeNull();
  });

  it("refuses a time in the past or now", () => {
    expect(checkDndRequest({ until: later(-1), indefinite: false }, NOW)).toBe(
      "UNTIL_NOT_IN_FUTURE",
    );
    expect(checkDndRequest({ until: NOW, indefinite: false }, NOW)).toBe(
      "UNTIL_NOT_IN_FUTURE",
    );
  });

  it("refuses more than seven days", () => {
    expect(
      checkDndRequest(
        { until: later(MAX_SNOOZE_MS + 1), indefinite: false },
        NOW,
      ),
    ).toBe("UNTIL_TOO_FAR");
  });

  it("refuses a timed snooze together with indefinite", () => {
    expect(
      checkDndRequest({ until: later(60_000), indefinite: true }, NOW),
    ).toBe("BOTH_GIVEN");
  });
});
