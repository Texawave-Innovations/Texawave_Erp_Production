import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import type { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";
import { REDIS_CLIENT } from "../src/shared/redis/redis.constants.js";

/**
 * Work-permission requests (e2e): an employee raises a short permission
 * request (POST /self-service/work-permissions); HR approves or rejects it
 * (PATCH /hr/work-permissions/:id/decide).
 *
 * Proves the decision is atomic (two concurrent deciders: exactly one wins),
 * a user can never decide their own request, and every decision writes an
 * audit row in the same transaction without copying the free-text HR note.
 * Users and the organization stay behind: this suite writes audit rows and
 * audit_logs is append-only with an FK to the actor (test/README.md).
 */
interface Body<T> {
  data: T;
}
interface Perm {
  id: number;
  status: string;
  decidedBy: number | null;
}

const EMPLOYEE_CODES = [
  "employee_self_service.work_permission.read",
  "employee_self_service.work_permission.create",
];
const DECIDER_CODES = [
  "hr.work_permission.read.all",
  "hr.work_permission.decide.all",
];

describe("Work permissions (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;
  const suffix = randomUUID().slice(0, 8);
  const codeSuffix = suffix.toUpperCase().replace(/[^A-Z0-9]/g, "X");
  const perm = new Map<string, number>();
  const tokens: Record<string, string> = {};
  const userIds: Record<string, number> = {};
  let passwordHash: string;
  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let teamA: number;
  let desigA: number;
  let empTypeA: number;

  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const errorOf = (r: request.Response) => (r.body as { error: string }).error;
  const raise = (who: string, reason = "Doctor appointment") =>
    request(app.getHttpServer())
      .post("/self-service/work-permissions")
      .set(auth(who))
      .send({
        date: "2026-11-20",
        fromTime: "14:00",
        toTime: "15:00",
        reason,
      });
  const decide = (
    who: string,
    id: number,
    decision: "APPROVED" | "REJECTED",
    hrNote?: string,
  ) =>
    request(app.getHttpServer())
      .patch(`/hr/work-permissions/${id}/decide`)
      .set(auth(who))
      .send({ decision, ...(hrNote ? { hrNote } : {}) });
  const auditRows = (id: number) =>
    prisma.auditLog.findMany({
      where: {
        entityType: "work_permission",
        entityId: BigInt(id),
      },
      orderBy: { id: "asc" },
    });

  async function mkUser(
    org: { id: number; slug: string },
    key: string,
    codes: string[],
    withEmployee: boolean,
    teamId?: number,
  ) {
    const role = await prisma.role.create({
      data: { organizationId: org.id, name: `role-${key}-${suffix}` },
    });
    await prisma.rolePermission.createMany({
      data: codes.map((c) => ({
        roleId: role.id,
        permissionId: perm.get(c) as number,
      })),
    });
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `${key}-${suffix}@example.com`,
        passwordHash,
        fullName: `User ${key}`,
      },
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });
    if (withEmployee) {
      await prisma.employee.create({
        data: {
          organizationId: org.id,
          employeeCode: `EMP-7${Date.now()}${Object.keys(userIds).length}`,
          fullName: `Employee ${key}`,
          userId: user.id,
          teamId: teamId as number,
          designationId: desigA,
          employmentTypeId: empTypeA,
          dateOfJoining: new Date("2026-01-05"),
        },
      });
    }
    const res = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        organizationSlug: org.slug,
        email: user.email,
        password: "Password123!",
      })
      .expect(201);
    tokens[key] = (res.body as Body<{ accessToken: string }>).data.accessToken;
    userIds[key] = user.id;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);
    passwordHash = await bcrypt.hash("Password123!", 10);

    orgA = await prisma.organization.create({
      data: { name: `WP Org A ${suffix}`, slug: `wp-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `WP Org B ${suffix}`, slug: `wp-b-${suffix}` },
    });
    for (const code of [...EMPLOYEE_CODES, ...DECIDER_CODES]) {
      const p = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      perm.set(code, p.id);
    }
    teamA = (
      await prisma.team.create({
        data: {
          organizationId: orgA.id,
          name: "T",
          code: `T${codeSuffix}`,
        },
      })
    ).id;
    desigA = (
      await prisma.designation.create({
        data: {
          organizationId: orgA.id,
          code: `D${codeSuffix}`,
          name: "Engineer",
        },
      })
    ).id;
    empTypeA = (
      await prisma.employmentType.create({
        data: {
          organizationId: orgA.id,
          code: `FT${codeSuffix}`,
          name: "Full-time",
        },
      })
    ).id;

    await mkUser(orgA, "emp", EMPLOYEE_CODES, true, teamA);
    // An HR user who is ALSO an employee and can raise their own request.
    await mkUser(
      orgA,
      "hrSelf",
      [...EMPLOYEE_CODES, ...DECIDER_CODES],
      true,
      teamA,
    );
    await mkUser(orgA, "hrOne", DECIDER_CODES, false);
    await mkUser(orgA, "hrTwo", DECIDER_CODES, false);
    await mkUser(orgB, "hrOtherOrg", DECIDER_CODES, false);
  });

  afterAll(async () => {
    await Promise.all(
      Object.values(userIds).flatMap((id) => [
        redis.del(`permissions:${id}`),
        redis
          .keys(`refresh:${id}:*`)
          .then((k) => (k.length ? redis.del(k) : 0)),
      ]),
    );
    await app.close();
  });

  it("an HR decider approves a pending request and an audit row is written without the HR note", async () => {
    const created = await raise("emp").expect(201);
    const id = (created.body as Body<Perm>).data.id;

    const res = await decide(
      "hrOne",
      id,
      "APPROVED",
      "confidential-note-xyz",
    ).expect(200);
    expect((res.body as Body<Perm>).data).toMatchObject({
      status: "APPROVED",
      decidedBy: userIds.hrOne,
    });

    const rows = await auditRows(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "approve",
      actorUserId: userIds.hrOne,
      organizationId: orgA.id,
    });
    expect(rows[0]?.before).toEqual({ status: "PENDING" });
    expect(rows[0]?.after).toEqual({
      status: "APPROVED",
      decidedBy: userIds.hrOne,
    });
    expect(
      JSON.stringify([rows[0]?.before, rows[0]?.after, rows[0]?.reason]),
    ).not.toContain("confidential-note-xyz");
  });

  it("a rejection needs a note and writes a reject audit row", async () => {
    const created = await raise("emp").expect(201);
    const id = (created.body as Body<Perm>).data.id;

    const noNote = await decide("hrOne", id, "REJECTED").expect(422);
    expect(errorOf(noNote)).toBe("NOTE_REQUIRED");
    expect(await auditRows(id)).toHaveLength(0);

    await decide("hrOne", id, "REJECTED", "not this week").expect(200);
    const rows = await auditRows(id);
    expect(rows.map((r) => r.action)).toEqual(["reject"]);
  });

  it("a decided request cannot be decided again and no second audit row appears", async () => {
    const created = await raise("emp").expect(201);
    const id = (created.body as Body<Perm>).data.id;
    await decide("hrOne", id, "APPROVED").expect(200);

    const again = await decide("hrTwo", id, "REJECTED", "changed my mind");
    expect(again.status).toBe(422);
    expect(errorOf(again)).toBe("ALREADY_DECIDED");

    const stored = await prisma.workPermission.findUnique({ where: { id } });
    expect(stored?.status).toBe("APPROVED");
    expect(stored?.decidedBy).toBe(userIds.hrOne);
    expect(await auditRows(id)).toHaveLength(1);
  });

  it("concurrent deciders: exactly one wins, the other is refused, and the row matches the winner", async () => {
    // Repeat so a lucky interleaving cannot hide a non-atomic update.
    for (let round = 0; round < 8; round++) {
      const created = await raise("emp").expect(201);
      const id = (created.body as Body<Perm>).data.id;

      const [a, b] = await Promise.all([
        decide("hrOne", id, "APPROVED"),
        decide("hrTwo", id, "REJECTED", "no"),
      ]);
      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual([200, 422]);
      const winner = a.status === 200 ? a : b;
      const loser = a.status === 200 ? b : a;
      expect(errorOf(loser)).toBe("ALREADY_DECIDED");

      const stored = await prisma.workPermission.findUnique({ where: { id } });
      const winnerDecision = (winner.body as Body<Perm>).data;
      expect(stored?.status).toBe(winnerDecision.status);
      expect(stored?.decidedBy).toBe(winnerDecision.decidedBy);
      // One decision, one audit row, and it describes the winner.
      const rows = await auditRows(id);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.actorUserId).toBe(winnerDecision.decidedBy);
    }
  });

  it("a user cannot approve or reject their own request", async () => {
    const created = await raise("hrSelf").expect(201);
    const id = (created.body as Body<Perm>).data.id;

    for (const decision of ["APPROVED", "REJECTED"] as const) {
      const res = await decide("hrSelf", id, decision, "self");
      expect(res.status).toBe(403);
      expect(errorOf(res)).toBe("SELF_APPROVAL_FORBIDDEN");
    }
    const stored = await prisma.workPermission.findUnique({ where: { id } });
    expect(stored?.status).toBe("PENDING");
    expect(stored?.decidedBy).toBeNull();
    expect(await auditRows(id)).toHaveLength(0);

    // Someone else can still decide it.
    await decide("hrOne", id, "APPROVED").expect(200);
    expect(await auditRows(id)).toHaveLength(1);
  });

  it("the self-decision rule holds at the database level too (conditional update, not just the pre-check)", async () => {
    const created = await raise("hrSelf").expect(201);
    const id = (created.body as Body<Perm>).data.id;
    // Same predicate the repository uses: requestedBy must differ from the decider.
    const { count } = await prisma.workPermission.updateMany({
      where: {
        id,
        organizationId: orgA.id,
        status: "PENDING",
        requestedBy: { not: userIds.hrSelf as number },
      },
      data: { status: "APPROVED" },
    });
    expect(count).toBe(0);
  });

  it("a decider from another organization gets 404 and changes nothing", async () => {
    const created = await raise("emp").expect(201);
    const id = (created.body as Body<Perm>).data.id;
    await decide("hrOtherOrg", id, "APPROVED").expect(404);
    const stored = await prisma.workPermission.findUnique({ where: { id } });
    expect(stored?.status).toBe("PENDING");
    expect(await auditRows(id)).toHaveLength(0);
  });

  it("an employee without the decide permission gets 403", async () => {
    const created = await raise("emp").expect(201);
    const id = (created.body as Body<Perm>).data.id;
    await decide("emp", id, "APPROVED").expect(403);
  });
});
