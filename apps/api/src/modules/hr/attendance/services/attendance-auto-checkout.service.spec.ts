import {
  AttendanceAutoCheckoutService,
  planAutoCheckouts,
} from "./attendance-auto-checkout.service.js";
import { AttendanceAutoCheckoutScheduler } from "./attendance-auto-checkout.scheduler.js";

const ASOF = new Date("2026-10-05T06:00:00Z"); // 11:30 IST on 2026-10-05
const ORG = 7;
const at = (iso: string) => new Date(iso);

describe("planAutoCheckouts (pure rule)", () => {
  it("closes a session at check-in plus the shift target, not at the run time", () => {
    // Check-in 03:00Z + 480 min = 11:00Z. The run happens later, at 12:00Z.
    const plan = planAutoCheckouts(
      [{ id: 1, checkInAt: at("2026-10-05T03:00:00Z"), targetMinutes: 480 }],
      at("2026-10-05T12:00:00Z"),
    );
    expect(plan.closes).toEqual([
      { id: 1, checkOutAt: at("2026-10-05T11:00:00Z") },
    ]);
  });

  it("leaves a session open while its target has not elapsed", () => {
    const plan = planAutoCheckouts(
      [{ id: 2, checkInAt: at("2026-10-05T05:00:00Z"), targetMinutes: 480 }],
      ASOF,
    );
    expect(plan).toEqual({ closes: [], noTarget: 0, notDue: 1 });
  });

  it("leaves a session open when no shift target applies (never invents a duration)", () => {
    const plan = planAutoCheckouts(
      [{ id: 3, checkInAt: at("2026-10-04T03:00:00Z"), targetMinutes: null }],
      ASOF,
    );
    expect(plan).toEqual({ closes: [], noTarget: 1, notDue: 0 });
  });

  it("handles several sessions with different outcomes independently", () => {
    const plan = planAutoCheckouts(
      [
        { id: 1, checkInAt: at("2026-10-04T03:00:00Z"), targetMinutes: 240 },
        { id: 2, checkInAt: at("2026-10-05T05:00:00Z"), targetMinutes: 480 },
        { id: 3, checkInAt: at("2026-10-04T03:00:00Z"), targetMinutes: null },
      ],
      ASOF,
    );
    expect(plan.closes.map((c) => c.id)).toEqual([1]);
    expect(plan.notDue).toBe(1);
    expect(plan.noTarget).toBe(1);
  });

  it("with no eligible sessions, plans nothing", () => {
    expect(planAutoCheckouts([], ASOF)).toEqual({
      closes: [],
      noTarget: 0,
      notDue: 0,
    });
  });
});

interface Row {
  id: number;
  checkInAt: Date;
  attendanceDate: Date;
  employeeId: number;
}

function makeService(
  open: Row[],
  opts: { updateCount?: number; orgs?: number[] } = {},
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
            employee: { id: r.employeeId, teamId: 1, workLocationId: null },
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
  const dayContext = {
    load: vi.fn().mockResolvedValue({
      holidays: [],
      weeklyOffRules: [],
      approvedLeaves: [],
      shiftAssignments: [
        {
          employeeId: null,
          teamId: 1,
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          workingMinutes: 480,
        },
      ],
    }),
  };
  const service = new AttendanceAutoCheckoutService(
    prisma as never,
    audit as never,
    dayContext as never,
  );
  return { service, prisma, tx, audit, dayContext };
}

describe("AttendanceAutoCheckoutService", () => {
  const dueRow: Row = {
    id: 11,
    checkInAt: at("2026-10-04T03:00:00Z"),
    attendanceDate: at("2026-10-04T00:00:00Z"),
    employeeId: 1,
  };

  it("closes an open session once due, and audits it as a system actor with no user", async () => {
    const { service, tx, audit } = makeService([dueRow]);
    const result = await service.runForOrganization(ORG, ASOF);

    expect(result).toEqual({ closed: 1, noTarget: 0, notDue: 0 });
    expect(tx.attendanceSession.updateMany).toHaveBeenCalledWith({
      where: { id: 11, checkOutAt: null },
      data: { checkOutAt: at("2026-10-04T11:00:00Z") },
    });
    const entry = audit.write.mock.calls[0]![1] as Record<string, unknown>;
    expect(entry).toMatchObject({
      entityType: "attendance_session",
      entityId: 11,
      action: "auto_checkout",
      system: { organizationId: ORG, label: "attendance.auto_checkout" },
    });
    expect(entry).not.toHaveProperty("userId");
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

  it("a session closed by a concurrent instance is not audited twice", async () => {
    const { service, audit } = makeService([dueRow], { updateCount: 0 });
    const result = await service.runForOrganization(ORG, ASOF);
    expect(result.closed).toBe(0);
    expect(audit.write).not.toHaveBeenCalled();
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

  it("with no eligible sessions, writes nothing and loads no calendar", async () => {
    const { service, audit, dayContext } = makeService([]);
    const result = await service.runForOrganization(ORG, ASOF);
    expect(result).toEqual({ closed: 0, noTarget: 0, notDue: 0 });
    expect(audit.write).not.toHaveBeenCalled();
    expect(dayContext.load).not.toHaveBeenCalled();
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
