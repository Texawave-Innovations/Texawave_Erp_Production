import {
  computeOpportunityHealth,
  dayStart,
  diffInDays,
  reconcile,
  type NotificationCandidate,
} from "./crm-notification-rules.js";

const DAY = 86_400_000;
const now = new Date("2026-10-16T12:00:00Z");
const day = (n: number) => new Date(dayStart(now).getTime() + n * DAY);

const candidate = (diffDays: number): NotificationCandidate => ({
  sourceType: "followUp",
  sourceId: 1,
  type: diffDays < 0 ? "followup-overdue" : "followup-due",
  title: "t",
  description: "d",
  accountId: 1,
  companyName: "Acme",
  prospectName: null,
  dueDate: day(diffDays),
  priority: "medium",
  diffDays,
});

describe("crm notification rules", () => {
  it("computes whole-day differences on UTC days", () => {
    expect(diffInDays(new Date("2026-10-17T23:00:00Z"), now)).toBe(1);
    expect(diffInDays(new Date("2026-10-15T01:00:00Z"), now)).toBe(-1);
  });

  it("applies stage SLA overrides to opportunity health", () => {
    const at = (d: number) => new Date(now.getTime() - d * DAY);
    expect(computeOpportunityHealth(at(6), "OPEN", now, null).health).toBe(
      "Healthy",
    );
    expect(computeOpportunityHealth(at(8), "OPEN", now, null).health).toBe(
      "Delayed",
    );
    expect(computeOpportunityHealth(at(15), "OPEN", now, null).health).toBe(
      "Critical",
    );
    expect(computeOpportunityHealth(at(5), "OPEN", now, 4).health).toBe(
      "Delayed",
    );
    expect(computeOpportunityHealth(at(9), "OPEN", now, 4).health).toBe(
      "Critical",
    );
    expect(computeOpportunityHealth(at(30), "WON", now, null).health).toBe(
      "Healthy",
    );
  });

  it("reconcile never touches Done or recycled rows with an unchanged due day", () => {
    const base = {
      id: 1,
      dueDate: day(-1),
      snoozeUntil: null,
      deletedAt: null,
    };
    expect(
      reconcile({ ...base, status: "Done" }, candidate(-1), now),
    ).toBeNull();
    expect(
      reconcile(
        { ...base, status: "Overdue", deletedAt: now },
        candidate(-1),
        now,
      ),
    ).toBeNull();
  });

  it("reconcile escalates Pending/Acknowledged to Overdue and expires snoozes", () => {
    const base = { id: 1, dueDate: day(-1), deletedAt: null };
    expect(
      reconcile(
        { ...base, status: "Pending", snoozeUntil: null },
        candidate(-1),
        now,
      ),
    ).toEqual({ kind: "patch", data: { status: "Overdue", priority: "high" } });
    expect(
      reconcile(
        {
          ...base,
          status: "Snoozed",
          snoozeUntil: new Date(now.getTime() + 1),
        },
        candidate(-1),
        now,
      ),
    ).toBeNull();
    expect(
      reconcile(
        {
          ...base,
          status: "Snoozed",
          snoozeUntil: new Date(now.getTime() - 1),
        },
        candidate(-1),
        now,
      ),
    ).toEqual({
      kind: "patch",
      data: { status: "Overdue", snoozeUntil: null },
    });
  });

  it("reconcile resets a row when the due day changed", () => {
    const result = reconcile(
      {
        id: 1,
        dueDate: day(-3),
        status: "Done",
        snoozeUntil: null,
        deletedAt: null,
      },
      candidate(-1),
      now,
    );
    expect(result?.kind).toBe("reset");
    expect(result?.data).toMatchObject({
      status: "Overdue",
      isRead: false,
      completedAt: null,
      deletedAt: null,
    });
  });
});
