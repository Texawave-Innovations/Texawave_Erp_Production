import {
  AttendanceAutoCheckoutService,
  autoCheckoutNotifications,
} from "./attendance-auto-checkout.service.js";
import { AttendanceAutoCheckoutScheduler } from "./attendance-auto-checkout.scheduler.js";

const ASOF = new Date("2026-10-05T06:00:00Z"); // 11:30 IST on 2026-10-05
const ORG = 7;
const at = (iso: string) => new Date(iso);
// 23:59 IST on 2026-10-04: the end-of-day cut-off for a forgotten session.
const END_OF_4_OCT = at("2026-10-04T18:29:00Z");

interface Row {
  id: number;
  checkInAt: Date;
  attendanceDate: Date;
  employeeId: number;
}

function makeService(
  open: Row[],
  opts: {
    updateCount?: number;
    orgs?: number[];
    settings?: { autoCheckoutEnabled: boolean; autoCheckoutTime: string };
  } = {},
) {
  const tx = {
    attendanceSession: {
      updateMany: vi.fn().mockResolvedValue({ count: opts.updateCount ?? 1 }),
    },
  };
  const prisma = {
    attendanceSession: {
      findMany: vi.fn().mockResolvedValue(
        open.map((r) => ({
          id: r.id,
          checkInAt: r.checkInAt,
          record: {
            attendanceDate: r.attendanceDate,
            employee: { employeeCode: `E${r.employeeId}`, fullName: "E" },
          },
        })),
      ),
    },
    organization: {
      findMany: vi
        .fn()
        .mockResolvedValue((opts.orgs ?? [ORG]).map((id) => ({ id }))),
    },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };
  const audit = { write: vi.fn().mockResolvedValue(undefined) };
  const notifications = { notify: vi.fn().mockResolvedValue(0) };
  const settings = { find: vi.fn().mockResolvedValue(opts.settings ?? null) };
  const service = new AttendanceAutoCheckoutService(
    prisma as never,
    audit as never,
    notifications as never,
    settings as never,
  );
  return { service, prisma, tx, audit, notifications, settings };
}

describe("AttendanceAutoCheckoutService — end-of-day cut-off (default)", () => {
  const dueRow: Row = {
    id: 11,
    checkInAt: at("2026-10-04T03:30:00Z"), // 09:00 IST
    attendanceDate: at("2026-10-04T00:00:00Z"),
    employeeId: 1,
  };

  it("closes a forgotten session at 23:59 IST of its own day, flagged unverified, and audits it as a system actor", async () => {
    const { service, tx, audit } = makeService([dueRow]);
    const result = await service.runForOrganization(ORG, ASOF);

    expect(result).toEqual({ closed: 1, noTarget: 0, notDue: 0 });
    // Not check-in + shift target: the close is technical, so it is flagged.
    expect(tx.attendanceSession.updateMany).toHaveBeenCalledWith({
      where: { id: 11, checkOutAt: null },
      data: { checkOutAt: END_OF_4_OCT, autoClosed: true },
    });
    const entry = audit.write.mock.calls[0]![1] as Record<string, unknown>;
    expect(entry).toMatchObject({
      entityType: "attendance_session",
      entityId: 11,
      action: "auto_checkout",
      after: { checkOutAt: END_OF_4_OCT.toISOString() },
      system: { organizationId: ORG, label: "attendance.auto_checkout" },
    });
    expect(entry).not.toHaveProperty("userId");
  });

  it("the HR master setting switched off still closes at the end of the day (no shift-target rule)", async () => {
    const { service, tx } = makeService([dueRow], {
      settings: { autoCheckoutEnabled: false, autoCheckoutTime: "20:00" },
    });
    await service.runForOrganization(ORG, ASOF);
    expect(tx.attendanceSession.updateMany).toHaveBeenCalledWith({
      where: { id: 11, checkOutAt: null },
      data: { checkOutAt: END_OF_4_OCT, autoClosed: true },
    });
  });

  it("leaves today's session open until the end of the day", async () => {
    const today: Row = {
      id: 12,
      checkInAt: at("2026-10-05T03:30:00Z"),
      attendanceDate: at("2026-10-05T00:00:00Z"),
      employeeId: 2,
    };
    // 23:58 IST on 5 Oct: one minute before the cut-off.
    const { service, tx } = makeService([today]);
    const result = await service.runForOrganization(
      ORG,
      at("2026-10-05T18:28:00Z"),
    );
    expect(result).toEqual({ closed: 0, noTarget: 0, notDue: 1 });
    expect(tx.attendanceSession.updateMany).not.toHaveBeenCalled();
  });

  it("closes today's session once IST midnight's eve passes (timezone boundary)", async () => {
    const today: Row = {
      id: 13,
      checkInAt: at("2026-10-05T03:30:00Z"),
      attendanceDate: at("2026-10-05T00:00:00Z"),
      employeeId: 2,
    };
    // 00:00 IST on 6 Oct is still 5 Oct in UTC; the IST day decides.
    const { service, tx } = makeService([today]);
    await service.runForOrganization(ORG, at("2026-10-05T18:30:00Z"));
    expect(tx.attendanceSession.updateMany).toHaveBeenCalledWith({
      where: { id: 13, checkOutAt: null },
      data: { checkOutAt: at("2026-10-05T18:29:00Z"), autoClosed: true },
    });
  });

  it("repeated execution is idempotent: the conditional write matches nothing the second time", async () => {
    const first = makeService([dueRow]);
    await first.service.runForOrganization(ORG, ASOF);
    expect(first.audit.write).toHaveBeenCalledTimes(1);

    // A second run sees no open session (the database now has check_out_at set).
    const second = makeService([]);
    const result = await second.service.runForOrganization(ORG, ASOF);
    expect(result).toEqual({ closed: 0, noTarget: 0, notDue: 0 });
    expect(second.audit.write).not.toHaveBeenCalled();
  });

  it("a manual check-out that won the race is never overwritten, and not audited", async () => {
    // The conditional update (check_out_at IS NULL) matches nothing.
    const { service, audit, notifications } = makeService([dueRow], {
      updateCount: 0,
    });
    const result = await service.runForOrganization(ORG, ASOF);
    expect(result.closed).toBe(0);
    expect(audit.write).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it("only open sessions are queried (already-closed sessions are never selected)", async () => {
    const { service, prisma } = makeService([]);
    await service.runForOrganization(ORG, ASOF);
    const where = (
      prisma.attendanceSession.findMany.mock.calls[0]![0] as {
        where: { checkOutAt: null };
      }
    ).where;
    expect(where.checkOutAt).toBeNull();
  });

  it("handles multiple employees, closing only those that are due", async () => {
    const { service, audit } = makeService([
      dueRow,
      {
        id: 12,
        checkInAt: at("2026-10-05T05:00:00Z"),
        attendanceDate: at("2026-10-05T00:00:00Z"),
        employeeId: 2,
      },
      {
        id: 13,
        checkInAt: at("2026-10-04T03:00:00Z"),
        attendanceDate: at("2026-10-04T00:00:00Z"),
        employeeId: 3,
      },
    ]);
    const result = await service.runForOrganization(ORG, ASOF);
    expect(result).toEqual({ closed: 2, noTarget: 0, notDue: 1 });
    expect(audit.write).toHaveBeenCalledTimes(2);
  });

  it("with no eligible sessions, writes nothing and reads no settings", async () => {
    const { service, audit, settings } = makeService([]);
    const result = await service.runForOrganization(ORG, ASOF);
    expect(result).toEqual({ closed: 0, noTarget: 0, notDue: 0 });
    expect(audit.write).not.toHaveBeenCalled();
    expect(settings.find).not.toHaveBeenCalled();
  });

  it("runs across active organizations and isolates a failure to one organization", async () => {
    const { service, prisma } = makeService([dueRow], { orgs: [ORG, 8] });
    const original = prisma.attendanceSession.findMany.getMockImplementation();
    prisma.attendanceSession.findMany
      .mockRejectedValueOnce(new Error("boom"))
      .mockImplementation(original!);
    const result = await service.runForAllOrganizations(ASOF);
    expect(result.failedOrganizations).toBe(1);
    expect(result.closed).toBe(1);
  });
});

describe("AttendanceAutoCheckoutService — HR master's earlier cut-off", () => {
  const on = { autoCheckoutEnabled: true, autoCheckoutTime: "20:00" };
  // A forgotten check-out on Saturday 14 Nov, found on Monday 16 Nov.
  const forgotten: Row = {
    id: 21,
    checkInAt: at("2026-11-14T04:00:00Z"),
    attendanceDate: at("2026-11-14T00:00:00Z"),
    employeeId: 3,
  };
  const monday = at("2026-11-16T03:10:00Z");

  it("closes the forgotten session at that day's cut-off and flags it pending", async () => {
    const { service, tx, audit } = makeService([forgotten], { settings: on });
    const result = await service.runForOrganization(ORG, monday);

    expect(result).toEqual({ closed: 1, noTarget: 0, notDue: 0 });
    expect(tx.attendanceSession.updateMany).toHaveBeenCalledWith({
      where: { id: 21, checkOutAt: null },
      data: { checkOutAt: at("2026-11-14T14:30:00Z"), autoClosed: true },
    });
    expect(audit.write.mock.calls[0]![1]).toMatchObject({
      action: "auto_checkout",
      system: { organizationId: ORG, label: "attendance.auto_checkout" },
    });
  });

  it("leaves today's session open until the cut-off", async () => {
    const today: Row = {
      id: 22,
      checkInAt: at("2026-11-16T04:00:00Z"),
      attendanceDate: at("2026-11-16T00:00:00Z"),
      employeeId: 4,
    };
    const { service, tx } = makeService([today], { settings: on });
    const result = await service.runForOrganization(
      ORG,
      at("2026-11-16T10:00:00Z"),
    );
    expect(result).toEqual({ closed: 0, noTarget: 0, notDue: 1 });
    expect(tx.attendanceSession.updateMany).not.toHaveBeenCalled();
  });
});

describe("autoCheckoutNotifications", () => {
  it("tells the employee the close time is not their check-out and how to regularize", () => {
    const [notice] = autoCheckoutNotifications(1, "2026-10-04", END_OF_4_OCT, {
      userId: 5,
      employeeCode: "E1",
      fullName: "E",
    });
    expect(notice?.body).toContain("23:59");
    expect(notice?.body).toContain("not your check-out time");
    expect(notice?.body).toContain("Missed check-out");
  });
});

describe("AttendanceAutoCheckoutScheduler", () => {
  it("does not start a second run while one is in progress", async () => {
    let release!: () => void;
    const job = {
      runForAllOrganizations: vi.fn(
        () =>
          new Promise(
            (resolve) =>
              (release = () =>
                resolve({
                  closed: 0,
                  noTarget: 0,
                  notDue: 0,
                  failedOrganizations: 0,
                })),
          ),
      ),
    };
    const scheduler = new AttendanceAutoCheckoutScheduler(job as never);
    const first = scheduler.tick();
    await scheduler.tick();
    expect(job.runForAllOrganizations).toHaveBeenCalledTimes(1);
    release();
    await first;
  });

  it("logs and recovers from a failed run so the next tick can run", async () => {
    const job = {
      runForAllOrganizations: vi
        .fn()
        .mockRejectedValueOnce(new Error("db down"))
        .mockResolvedValue({
          closed: 0,
          noTarget: 0,
          notDue: 0,
          failedOrganizations: 0,
        }),
    };
    const scheduler = new AttendanceAutoCheckoutScheduler(job as never);
    await expect(scheduler.tick()).resolves.toBeUndefined();
    await scheduler.tick();
    expect(job.runForAllOrganizations).toHaveBeenCalledTimes(2);
  });
});
