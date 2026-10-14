import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";
import { REDIS_CLIENT } from "../src/shared/redis/redis.constants.js";
import { AttendanceAutoCheckoutService } from "../src/modules/hr/attendance/services/attendance-auto-checkout.service.js";

/**
 * Attendance auto-checkout (e2e), driven through the real job with a controlled
 * clock. The live scheduler also runs on its own timer; every assertion is
 * therefore on DATABASE STATE and on the single audit row, never on how many
 * sessions "this call" closed, since a concurrent tick may close one first.
 */
const d = (day: string) => new Date(`${day}T00:00:00Z`);
const utc = (iso: string) => new Date(iso);

describe("Attendance auto-checkout (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;
  let job: AttendanceAutoCheckoutService;
  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  const suffix = randomUUID()
    .slice(0, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "X");
  let team: number;
  let teamNoShift: number;
  let empCounter = 0;
  const ASOF = utc("2026-06-12T12:00:00Z");

  async function mkEmp(orgId: number, teamId: number) {
    const n = ++empCounter;
    const designation = await prisma.designation.upsert({
      where: { organizationId_code: { organizationId: orgId, code: "GEN" } },
      update: {},
      create: { organizationId: orgId, code: "GEN", name: "General" },
    });
    const type = await prisma.employmentType.upsert({
      where: { organizationId_code: { organizationId: orgId, code: "PERM" } },
      update: {},
      create: { organizationId: orgId, code: "PERM", name: "Permanent" },
    });
    return (
      await prisma.employee.create({
        data: {
          organizationId: orgId,
          employeeCode: `EMP-${300000 + n}`,
          fullName: `Auto Emp ${n}`,
          teamId,
          designationId: designation.id,
          employmentTypeId: type.id,
          dateOfJoining: new Date("2025-01-01T00:00:00Z"),
        },
      })
    ).id;
  }

  const openSession = async (
    orgId: number,
    employeeId: number,
    day: string,
    inAt: Date,
  ) => {
    const r = await prisma.attendanceRecord.create({
      data: { organizationId: orgId, employeeId, attendanceDate: d(day) },
    });
    return prisma.attendanceSession.create({
      data: { attendanceRecordId: r.id, checkInAt: inAt, source: "SELF" },
    });
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    job = app.get(AttendanceAutoCheckoutService);

    orgA = await prisma.organization.create({
      data: { name: `AC A ${suffix}`, slug: `ac-a-${suffix.toLowerCase()}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `AC B ${suffix}`, slug: `ac-b-${suffix.toLowerCase()}` },
    });
    team = (
      await prisma.team.create({
        data: { organizationId: orgA.id, name: "Shift", code: `SH${suffix}` },
      })
    ).id;
    teamNoShift = (
      await prisma.team.create({
        data: { organizationId: orgA.id, name: "NoShift", code: `NS${suffix}` },
      })
    ).id;

    const shift = await prisma.shift.create({
      data: {
        organizationId: orgA.id,
        code: `AC8${suffix}`,
        name: "Eight",
        startTime: "10:00",
        endTime: "18:30",
        isOvernight: false,
        workingMinutes: 480,
      },
    });
    await prisma.shiftAssignment.create({
      data: {
        organizationId: orgA.id,
        shiftId: shift.id,
        teamId: team,
        effectiveFrom: d("2026-01-01"),
      },
    });
    const shiftB = await prisma.shift.create({
      data: {
        organizationId: orgB.id,
        code: `ACB${suffix}`,
        name: "B",
        startTime: "10:00",
        endTime: "18:30",
        isOvernight: false,
        workingMinutes: 480,
      },
    });
    const teamB = (
      await prisma.team.create({
        data: { organizationId: orgB.id, name: "B", code: `BB${suffix}` },
      })
    ).id;
    await prisma.shiftAssignment.create({
      data: {
        organizationId: orgB.id,
        shiftId: shiftB.id,
        teamId: teamB,
        effectiveFrom: d("2026-01-01"),
      },
    });
  });

  afterAll(async () => {
    await redis?.quit().catch(() => undefined);
    await app?.close();
  });

  it("exposes no HTTP endpoint: it is a system job, not something a user can invoke", async () => {
    await request(app.getHttpServer())
      .post("/hr/attendance/auto-checkout")
      .expect(404);
    await request(app.getHttpServer())
      .post("/hr/attendance/auto-checkout/run")
      .expect(404);
  });

  it("closes an open session once due, at check-in plus the target", async () => {
    const emp = await mkEmp(orgA.id, team);
    const s = await openSession(
      orgA.id,
      emp,
      "2026-06-10",
      utc("2026-06-10T04:30:00Z"),
    );

    await job.runForAllOrganizations(ASOF);

    const after = await prisma.attendanceSession.findUniqueOrThrow({
      where: { id: s.id },
    });
    expect(after.checkOutAt?.toISOString()).toBe("2026-06-10T12:30:00.000Z");
  });

  it("writes exactly one audit row as a system actor with no user", async () => {
    const emp = await mkEmp(orgA.id, team);
    const s = await openSession(
      orgA.id,
      emp,
      "2026-06-10",
      utc("2026-06-10T04:00:00Z"),
    );

    await job.runForAllOrganizations(ASOF);
    await job.runForAllOrganizations(ASOF);

    const audits = await prisma.auditLog.findMany({
      where: {
        entityType: "attendance_session",
        entityId: BigInt(s.id),
        action: "auto_checkout",
      },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      actorType: "system",
      actorUserId: null,
      organizationId: orgA.id,
    });
  });

  it("leaves an already-closed session unchanged, and never audits it", async () => {
    const emp = await mkEmp(orgA.id, team);
    const r = await prisma.attendanceRecord.create({
      data: {
        organizationId: orgA.id,
        employeeId: emp,
        attendanceDate: d("2026-06-10"),
      },
    });
    const manual = utc("2026-06-10T11:15:00Z");
    const s = await prisma.attendanceSession.create({
      data: {
        attendanceRecordId: r.id,
        checkInAt: utc("2026-06-10T04:00:00Z"),
        checkOutAt: manual,
        source: "HR",
      },
    });

    await job.runForAllOrganizations(ASOF);

    const after = await prisma.attendanceSession.findUniqueOrThrow({
      where: { id: s.id },
    });
    expect(after.checkOutAt?.toISOString()).toBe(manual.toISOString());
    expect(
      await prisma.auditLog.count({
        where: { entityType: "attendance_session", entityId: BigInt(s.id) },
      }),
    ).toBe(0);
  });

  it("repeated execution makes no further change", async () => {
    const emp = await mkEmp(orgA.id, team);
    const s = await openSession(
      orgA.id,
      emp,
      "2026-06-11",
      utc("2026-06-11T04:00:00Z"),
    );
    await job.runForAllOrganizations(ASOF);
    const first = await prisma.attendanceSession.findUniqueOrThrow({
      where: { id: s.id },
    });

    const again = await job.runForAllOrganizations(ASOF);
    const second = await prisma.attendanceSession.findUniqueOrThrow({
      where: { id: s.id },
    });

    expect(second.checkOutAt).toEqual(first.checkOutAt);
    expect(again.closed).toBe(0);
  });

  it("a session not yet due stays open", async () => {
    const emp = await mkEmp(orgA.id, team);
    // Checked in tomorrow: its target cannot have elapsed by the real clock either.
    const s = await openSession(
      orgA.id,
      emp,
      "2099-01-02",
      utc("2099-01-02T04:00:00Z"),
    );
    await job.runForAllOrganizations(ASOF);
    const after = await prisma.attendanceSession.findUniqueOrThrow({
      where: { id: s.id },
    });
    expect(after.checkOutAt).toBeNull();
  });

  it("with no shift target, the session is left open rather than given an invented duration", async () => {
    const emp = await mkEmp(orgA.id, teamNoShift);
    const s = await openSession(
      orgA.id,
      emp,
      "2026-06-10",
      utc("2026-06-10T04:00:00Z"),
    );
    await job.runForAllOrganizations(ASOF);
    const after = await prisma.attendanceSession.findUniqueOrThrow({
      where: { id: s.id },
    });
    expect(after.checkOutAt).toBeNull();
  });

  it("handles several employees: each due session closes, the rest do not", async () => {
    const e1 = await mkEmp(orgA.id, team);
    const e2 = await mkEmp(orgA.id, team);
    const due = await openSession(
      orgA.id,
      e1,
      "2026-06-10",
      utc("2026-06-10T04:00:00Z"),
    );
    const notDue = await openSession(
      orgA.id,
      e2,
      "2099-01-03",
      utc("2099-01-03T04:00:00Z"),
    );
    await job.runForAllOrganizations(ASOF);
    expect(
      (
        await prisma.attendanceSession.findUniqueOrThrow({
          where: { id: due.id },
        })
      ).checkOutAt,
    ).not.toBeNull();
    expect(
      (
        await prisma.attendanceSession.findUniqueOrThrow({
          where: { id: notDue.id },
        })
      ).checkOutAt,
    ).toBeNull();
  });

  it("runs across organizations, closing each organization's own sessions only", async () => {
    const eA = await mkEmp(orgA.id, team);
    const teamB = await prisma.team.findFirstOrThrow({
      where: { organizationId: orgB.id, code: `BB${suffix}` },
    });
    const eB = await mkEmp(orgB.id, teamB.id);
    const sA = await openSession(
      orgA.id,
      eA,
      "2026-06-10",
      utc("2026-06-10T04:00:00Z"),
    );
    const sB = await openSession(
      orgB.id,
      eB,
      "2026-06-10",
      utc("2026-06-10T04:00:00Z"),
    );
    await job.runForAllOrganizations(ASOF);
    expect(
      (
        await prisma.attendanceSession.findUniqueOrThrow({
          where: { id: sA.id },
        })
      ).checkOutAt,
    ).not.toBeNull();
    expect(
      (
        await prisma.attendanceSession.findUniqueOrThrow({
          where: { id: sB.id },
        })
      ).checkOutAt,
    ).not.toBeNull();
    expect(
      await prisma.auditLog.count({
        where: {
          organizationId: orgB.id,
          entityType: "attendance_session",
          entityId: BigInt(sB.id),
        },
      }),
    ).toBe(1);
  });

  it("with no eligible sessions, the job completes and changes nothing", async () => {
    const result = await job.runForAllOrganizations(
      utc("2000-01-01T00:00:00Z"),
    );
    expect(result.failedOrganizations).toBe(0);
    expect(result.closed).toBe(0);
  });
});
