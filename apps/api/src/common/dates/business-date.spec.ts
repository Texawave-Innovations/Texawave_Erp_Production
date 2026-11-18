import {
  istDateOf,
  isoWeekdayOf as hrIsoWeekdayOf,
} from "../../modules/hr/attendance/services/attendance-calculation.service.js";
import { istToday } from "../../modules/hr/tasks/tasks.rules.js";
import {
  BUSINESS_TIMEZONE,
  addDays,
  allocateSegmentMinutes,
  businessDateOf,
  businessDayBounds,
  businessDayStart,
  businessInstant,
  businessTimeOf,
  businessToday,
  isoWeekdayOf,
  splitAtBusinessMidnight,
  weekStart,
} from "./business-date.js";

describe("business date (fixed IST business day)", () => {
  it("is Asia/Kolkata — the documented HR policy", () => {
    expect(BUSINESS_TIMEZONE).toBe("Asia/Kolkata");
  });

  describe("businessDateOf", () => {
    it.each([
      // [instant (UTC), expected IST date]
      ["2026-11-12T18:29:59.999Z", "2026-11-12"], // 23:59:59.999 IST
      ["2026-11-12T18:30:00.000Z", "2026-11-13"], // 00:00:00 IST next day
      ["2026-11-12T00:00:00.000Z", "2026-11-12"], // 05:30 IST
      ["2026-11-12T23:59:59.000Z", "2026-11-13"], // 05:29:59 IST next day
    ])("%s -> %s", (instant, expected) => {
      expect(businessDateOf(new Date(instant))).toBe(expected);
    });

    it("differs from the UTC date between 00:00 and 05:30 IST (the old Projects bug)", () => {
      const startedAt = new Date("2026-11-10T20:30:00.000Z"); // 02:00 IST on Nov 11
      expect(startedAt.toISOString().slice(0, 10)).toBe("2026-11-10"); // wrong day
      expect(businessDateOf(startedAt)).toBe("2026-11-11"); // right day
    });

    it("businessToday uses the supplied clock", () => {
      expect(businessToday(new Date("2026-11-12T18:30:00.000Z"))).toBe(
        "2026-11-13",
      );
    });
  });

  describe("HR delegates agree with the shared helper (no attendance behaviour change)", () => {
    const instants = [
      "2026-01-01T00:00:00.000Z",
      "2026-03-31T18:29:59.999Z",
      "2026-03-31T18:30:00.000Z",
      "2026-11-12T18:29:59.999Z",
      "2026-11-12T18:30:00.000Z",
      "2026-12-31T23:59:59.999Z",
    ].map((s) => new Date(s));

    it("istDateOf === businessDateOf and istToday === businessToday", () => {
      for (const d of instants) {
        expect(istDateOf(d)).toBe(businessDateOf(d));
        expect(istToday(d)).toBe(businessToday(d));
      }
    });

    it("isoWeekdayOf agrees", () => {
      for (const day of ["2026-11-09", "2026-11-15", "2026-11-16"]) {
        expect(hrIsoWeekdayOf(day)).toBe(isoWeekdayOf(day));
      }
    });
  });

  describe("calendar helpers", () => {
    it("isoWeekdayOf: Monday=1 … Sunday=7", () => {
      expect(isoWeekdayOf("2026-11-16")).toBe(1); // Monday
      expect(isoWeekdayOf("2026-11-22")).toBe(7); // Sunday
    });

    it("addDays crosses month and year ends", () => {
      expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
      expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
      expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    });

    it("weekStart returns the Monday", () => {
      expect(weekStart("2026-11-16")).toBe("2026-11-16");
      expect(weekStart("2026-11-19")).toBe("2026-11-16");
      expect(weekStart("2026-11-22")).toBe("2026-11-16");
    });

    it("day bounds are IST midnight to IST midnight", () => {
      const { start, end } = businessDayBounds("2026-11-12");
      expect(start.toISOString()).toBe("2026-11-11T18:30:00.000Z");
      expect(end.toISOString()).toBe("2026-11-12T18:30:00.000Z");
      expect(businessDayStart("2026-11-12").getTime()).toBe(start.getTime());
      // the bounds agree with businessDateOf at both edges
      expect(businessDateOf(start)).toBe("2026-11-12");
      expect(businessDateOf(new Date(end.getTime() - 1))).toBe("2026-11-12");
      expect(businessDateOf(end)).toBe("2026-11-13");
    });
  });

  describe("businessInstant (IST wall-clock time on a date)", () => {
    it("14:00 IST is 08:30 UTC on the same date", () => {
      expect(businessInstant("2026-11-16", "14:00")?.toISOString()).toBe(
        "2026-11-16T08:30:00.000Z",
      );
    });

    it("00:00 IST is the previous day 18:30 UTC (the day boundary)", () => {
      expect(businessInstant("2026-11-16", "00:00")?.toISOString()).toBe(
        "2026-11-15T18:30:00.000Z",
      );
      // and businessDateOf maps it back to the same IST day
      expect(
        businessDateOf(businessInstant("2026-11-16", "00:00") as Date),
      ).toBe("2026-11-16");
    });

    it("23:59 IST is still that IST day", () => {
      expect(
        businessDateOf(businessInstant("2026-11-16", "23:59") as Date),
      ).toBe("2026-11-16");
    });

    it("businessTimeOf is the inverse: instants read back as the IST HH:mm they were built from", () => {
      for (const t of ["00:00", "09:05", "14:00", "23:59"]) {
        expect(businessTimeOf(businessInstant("2026-11-16", t) as Date)).toBe(
          t,
        );
      }
      expect(businessTimeOf(new Date("2026-11-16T18:30:00.000Z"))).toBe(
        "00:00",
      );
    });

    it.each(["24:00", "9:30", "12:60", "ab:cd", "", "12:5", "12-30"])(
      "refuses %j (not a real HH:mm)",
      (bad) => {
        expect(businessInstant("2026-11-16", bad)).toBeNull();
      },
    );
  });

  describe("splitAtBusinessMidnight", () => {
    it("keeps a same-day session whole", () => {
      const segs = splitAtBusinessMidnight(
        new Date("2026-11-12T04:30:00.000Z"), // 10:00 IST
        new Date("2026-11-12T06:30:00.000Z"), // 12:00 IST
      );
      expect(segs).toHaveLength(1);
      expect(segs[0]?.date).toBe("2026-11-12");
    });

    it("splits 23:00 -> 00:30 IST into two days (fixture E3)", () => {
      const start = new Date("2026-11-12T17:30:00.000Z");
      const end = new Date("2026-11-12T19:00:00.000Z");
      const segs = splitAtBusinessMidnight(start, end);
      expect(segs.map((s) => s.date)).toEqual(["2026-11-12", "2026-11-13"]);
      expect(allocateSegmentMinutes(segs, 90)).toEqual([60, 30]);
    });

    it("splits a 48h session over three IST days (fixture E4)", () => {
      const segs = splitAtBusinessMidnight(
        new Date("2026-11-13T12:00:00.000Z"), // 17:30 IST Nov 13
        new Date("2026-11-15T12:00:00.000Z"), // 17:30 IST Nov 15
      );
      expect(segs.map((s) => s.date)).toEqual([
        "2026-11-13",
        "2026-11-14",
        "2026-11-15",
      ]);
      expect(allocateSegmentMinutes(segs, 2880)).toEqual([390, 1440, 1050]);
    });

    it("a session ending exactly at IST midnight stays on its start day (no empty trailing segment)", () => {
      const segs = splitAtBusinessMidnight(
        new Date("2026-11-12T17:30:00.000Z"), // 23:00 IST
        new Date("2026-11-12T18:30:00.000Z"), // 24:00 IST
      );
      expect(segs).toHaveLength(1);
      expect(segs[0]?.date).toBe("2026-11-12");
    });

    it("an empty or reversed range yields no segments (nothing fabricated)", () => {
      const t = new Date("2026-11-12T05:00:00.000Z");
      expect(splitAtBusinessMidnight(t, t)).toEqual([]);
      expect(splitAtBusinessMidnight(t, new Date(t.getTime() - 1))).toEqual([]);
    });

    it("segments are contiguous and cover exactly [start, end)", () => {
      const start = new Date("2026-11-13T12:00:00.000Z");
      const end = new Date("2026-11-16T03:17:00.000Z");
      const segs = splitAtBusinessMidnight(start, end);
      expect(segs[0]?.start.getTime()).toBe(start.getTime());
      expect(segs[segs.length - 1]?.end.getTime()).toBe(end.getTime());
      for (let i = 1; i < segs.length; i++) {
        expect(segs[i]?.start.getTime()).toBe(segs[i - 1]?.end.getTime());
      }
    });
  });

  describe("allocateSegmentMinutes", () => {
    it("always sums to the original total, whatever the rounding", () => {
      // 2 segments of 59.6 and 30.4 elapsed minutes but a recorded total of 90
      const start = new Date("2026-11-12T17:30:24.000Z");
      const end = new Date("2026-11-12T19:00:00.000Z");
      const segs = splitAtBusinessMidnight(start, end);
      const minutes = allocateSegmentMinutes(segs, 90);
      expect(minutes.reduce((a, b) => a + b, 0)).toBe(90);
    });

    it("a single segment takes the whole total", () => {
      const segs = splitAtBusinessMidnight(
        new Date("2026-11-12T04:30:00.000Z"),
        new Date("2026-11-12T06:30:00.000Z"),
      );
      expect(allocateSegmentMinutes(segs, 120)).toEqual([120]);
    });
  });
});
