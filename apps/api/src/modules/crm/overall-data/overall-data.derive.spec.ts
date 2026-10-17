import {
  countsFromRecords,
  deriveOverallData,
  istDayKey,
  monthDayKeys,
  type OverallSources,
} from "./overall-data.derive.js";

const empty: OverallSources = {
  mining: [],
  coldCalls: [],
  activities: [],
  meetings: [],
  statusChanges: [],
};

describe("overall-data derive", () => {
  it("buckets by IST day, not UTC day", () => {
    // 2026-03-31T20:00Z is already 01-Apr 01:30 in Asia/Kolkata
    const at = new Date("2026-03-31T20:00:00Z");
    expect(istDayKey(at)).toBe("2026-04-01");
    const rec = deriveOverallData(
      {
        ...empty,
        mining: [
          {
            id: 1,
            createdAt: at,
            owner: "A",
            companyName: "Co",
            keyDecisionMakers: null,
            followUpStatus: null,
            emailStatus: null,
            notes: null,
          },
        ],
      },
      2026,
      4,
    );
    expect(rec.accountsMined["2026-04-01"]).toHaveLength(1);
    expect(deriveOverallData({ ...empty, mining: [] }, 2026, 3)).toBeDefined();
    const march = deriveOverallData(
      {
        ...empty,
        mining: [
          {
            id: 1,
            createdAt: at,
            owner: "A",
            companyName: "Co",
            keyDecisionMakers: null,
            followUpStatus: null,
            emailStatus: null,
            notes: null,
          },
        ],
      },
      2026,
      3,
    );
    expect(Object.keys(march.accountsMined)).toHaveLength(0);
  });

  it("maps status tags to rows and counts equal record counts", () => {
    const at = new Date("2026-04-10T06:00:00Z");
    const mk = (id: number, statusTag: string) => ({
      id,
      at,
      owner: "A",
      accountId: 1,
      accountName: "Acme",
      statusTag,
      reason: null,
    });
    const rec = deriveOverallData(
      {
        ...empty,
        statusChanges: [
          mk(1, "Not Interested"),
          mk(2, "Keep in Touch"),
          mk(3, "Call Back"),
          mk(4, "Send Info"),
          mk(5, "Interested"),
        ],
      },
      2026,
      4,
    );
    const { daily, monthTotals } = countsFromRecords(rec);
    expect(daily.notInterested["2026-04-10"]).toBe(1);
    expect(daily.followUp["2026-04-10"]).toBe(1);
    expect(daily.sendInfoCallBacks["2026-04-10"]).toBe(2);
    expect(monthTotals.sendInfoCallBacks).toBe(2);
  });

  it("lists every day of the month", () => {
    expect(monthDayKeys(2026, 2)).toHaveLength(28);
    expect(monthDayKeys(2028, 2)).toHaveLength(29);
  });
});
