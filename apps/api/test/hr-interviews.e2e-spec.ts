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
 * Recruitment → Interview Schedule (legacy `InterviewSchedule.tsx`). Org-wide
 * by explicit permission: there is no owner to scope by, so the proof is
 * permission gating + organization isolation, not team scope. Covers create,
 * list/search/filter, read, status changes between the five legacy values
 * (any to any), validation, audit, persistence and DB constraints. No edit,
 * reschedule or delete exists.
 */
interface Body<T> {
  data: T;
  meta?: { total: number; page: number; limit: number; totalPages: number };
}

interface Interview {
  id: number;
  candidateName: string;
  roleTitle: string;
  interviewerName: string;
  interviewDate: string;
  interviewTime: string;
  mode: string;
  status: string;
  notes: string | null;
}

const PERMS = [
  "hr.interview.read",
  "hr.interview.write",
  "hr.revision_letter.read.team",
  "hr.revision_letter.write.team",
];

const VALID = {
  candidateName: "Ramesh Kumar",
  roleTitle: "Full Stack Developer",
  interviewerName: "Tech Lead",
  interviewDate: "2026-10-12",
  interviewTime: "14:30",
};

describe("HR interview schedule (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;
  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  const tokens: Record<string, string> = {};
  const userIds: Record<string, number> = {};
  const perm = new Map<string, number>();
  const suffix = randomUUID()
    .slice(0, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "X");

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });
  const get = (who: string, path: string) =>
    request(app.getHttpServer()).get(path).set(auth(who));
  const post = (who: string, path: string, body: object = {}) =>
    request(app.getHttpServer()).post(path).set(auth(who)).send(body);
  const setStatus = (who: string, id: number, status: string) =>
    request(app.getHttpServer())
      .patch(`/hr/interviews/${id}/status`)
      .set(auth(who))
      .send({ status });

  async function mkUser(
    org: { id: number; slug: string },
    key: string,
    codes: string[],
  ) {
    const role = await prisma.role.create({
      data: { organizationId: org.id, name: `role-${key}-${suffix}` },
    });
    if (codes.length) {
      await prisma.rolePermission.createMany({
        data: codes.map((c) => ({
          roleId: role.id,
          permissionId: perm.get(c) as number,
        })),
      });
    }
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `${key}@${org.slug}.test`,
        passwordHash: await bcrypt.hash("Password123!", 10),
        fullName: `User ${key}`,
      },
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });
    const login = await request(app.getHttpServer()).post("/auth/login").send({
      organizationSlug: org.slug,
      email: user.email,
      password: "Password123!",
    });
    expect(login.status).toBe(201);
    tokens[key] = (
      login.body as Body<{ accessToken: string }>
    ).data.accessToken;
    userIds[key] = user.id;
    return user;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);

    orgA = await prisma.organization.create({
      data: { name: `Iv A ${suffix}`, slug: `iv-a-${suffix.toLowerCase()}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Iv B ${suffix}`, slug: `iv-b-${suffix.toLowerCase()}` },
    });
    for (const code of PERMS) {
      const p = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      perm.set(code, p.id);
    }

    await mkUser(orgA, "hrA", ["hr.interview.read", "hr.interview.write"]);
    await mkUser(orgA, "readerA", ["hr.interview.read"]);
    await mkUser(orgA, "leadA", [
      "hr.revision_letter.read.team",
      "hr.revision_letter.write.team",
    ]);
    await mkUser(orgA, "nobody", []);
    await mkUser(orgB, "hrB", ["hr.interview.read", "hr.interview.write"]);
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

  // ---------------------------------------------------------------------------
  describe("authentication and permissions", () => {
    it("401 without a token", async () => {
      await request(app.getHttpServer()).get("/hr/interviews").expect(401);
      await request(app.getHttpServer())
        .post("/hr/interviews")
        .send(VALID)
        .expect(401);
    });

    it("403 without the interview permissions, including for a team lead holding only revision-letter permissions", async () => {
      await get("nobody", "/hr/interviews").expect(403);
      await post("nobody", "/hr/interviews", VALID).expect(403);
      await get("leadA", "/hr/interviews").expect(403);
      await post("leadA", "/hr/interviews", VALID).expect(403);
    });

    it("403 for a read-only holder trying to schedule or change status", async () => {
      await get("readerA", "/hr/interviews").expect(200);
      await post("readerA", "/hr/interviews", VALID).expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  describe("scheduling", () => {
    let created: Interview;

    it("201 schedules an interview starting SCHEDULED, with the legacy ONLINE default", async () => {
      const r = await post("hrA", "/hr/interviews", VALID).expect(201);
      created = (r.body as Body<Interview>).data;
      expect(created).toMatchObject({
        candidateName: "Ramesh Kumar",
        roleTitle: "Full Stack Developer",
        interviewerName: "Tech Lead",
        interviewDate: "2026-10-12",
        interviewTime: "14:30",
        mode: "ONLINE",
        status: "SCHEDULED",
        notes: null,
      });
    });

    it("persists the row in the hr schema for the caller's organization", async () => {
      const row = await prisma.interview.findUniqueOrThrow({
        where: { id: created.id },
      });
      expect(row.organizationId).toBe(orgA.id);
      expect(row.status).toBe("SCHEDULED");
      expect(row.createdBy).toBe(userIds.hrA);
    });

    it("writes a create audit row with the actor, without the candidate's name", async () => {
      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "interview",
          entityId: BigInt(created.id),
          action: "create",
        },
      });
      expect(audit.organizationId).toBe(orgA.id);
      expect(audit.actorUserId).toBe(userIds.hrA);
      expect(audit.after).toMatchObject({
        status: "SCHEDULED",
        mode: "ONLINE",
      });
      expect(JSON.stringify(audit.after)).not.toContain("Ramesh");
    });

    it("keeps an explicit mode and notes", async () => {
      const r = await post("hrA", "/hr/interviews", {
        ...VALID,
        mode: "PHONE",
        notes: "Resume: example.com/r",
      }).expect(201);
      expect((r.body as Body<Interview>).data).toMatchObject({
        mode: "PHONE",
        notes: "Resume: example.com/r",
      });
    });

    it("trims free text", async () => {
      const r = await post("hrA", "/hr/interviews", {
        ...VALID,
        candidateName: "  Padded Name  ",
      }).expect(201);
      expect((r.body as Body<Interview>).data.candidateName).toBe(
        "Padded Name",
      );
    });
  });

  // ---------------------------------------------------------------------------
  describe("validation", () => {
    it.each([
      ["missing candidate", { ...VALID, candidateName: undefined }],
      ["missing interviewer", { ...VALID, interviewerName: undefined }],
      ["missing role", { ...VALID, roleTitle: undefined }],
      ["hour out of range", { ...VALID, interviewTime: "25:00" }],
      ["time without minutes", { ...VALID, interviewTime: "14" }],
      ["impossible date", { ...VALID, interviewDate: "2026-02-31" }],
      ["mode outside the legacy set", { ...VALID, mode: "ZOOM" }],
      ["client-supplied status", { ...VALID, status: "SELECTED" }],
      ["an employee link (not a legacy field)", { ...VALID, employeeId: 1 }],
      [
        "a candidate reference (not a legacy field)",
        { ...VALID, candidateId: 1 },
      ],
    ])("400 for %s", async (_label, body) => {
      await post("hrA", "/hr/interviews", body).expect(400);
    });

    it("400 for a status outside the five legacy values, and nothing changes", async () => {
      const r = await post("hrA", "/hr/interviews", VALID).expect(201);
      const id = (r.body as Body<Interview>).data.id;
      await setStatus("hrA", id, "HIRED").expect(400);
      const row = await prisma.interview.findUniqueOrThrow({ where: { id } });
      expect(row.status).toBe("SCHEDULED");
    });
  });

  // ---------------------------------------------------------------------------
  describe("listing, search and reading", () => {
    let a: Interview;

    beforeAll(async () => {
      a = (
        (
          await post("hrA", "/hr/interviews", {
            ...VALID,
            candidateName: "Lakshmi Devi",
            roleTitle: "QA Engineer",
            interviewerName: "Manager Two",
          }).expect(201)
        ).body as Body<Interview>
      ).data;
    });

    it("lists with pagination metadata", async () => {
      const r = await get("hrA", "/hr/interviews?page=1&limit=2").expect(200);
      expect((r.body as Body<Interview[]>).meta).toMatchObject({
        page: 1,
        limit: 2,
      });
      expect((r.body as Body<Interview[]>).data.length).toBeLessThanOrEqual(2);
    });

    it("search matches candidate, role or interviewer, case-insensitively", async () => {
      const byCandidate = await get(
        "hrA",
        "/hr/interviews?search=LAKSHMI&limit=100",
      ).expect(200);
      expect(
        (byCandidate.body as Body<Interview[]>).data.map((i) => i.id),
      ).toContain(a.id);
      const byRole = await get(
        "hrA",
        "/hr/interviews?search=qa%20eng&limit=100",
      ).expect(200);
      expect(
        (byRole.body as Body<Interview[]>).data.map((i) => i.id),
      ).toContain(a.id);
      const byInterviewer = await get(
        "hrA",
        "/hr/interviews?search=manager%20two&limit=100",
      ).expect(200);
      expect(
        (byInterviewer.body as Body<Interview[]>).data.map((i) => i.id),
      ).toContain(a.id);
    });

    it("filters by status", async () => {
      await setStatus("hrA", a.id, "NO_SHOW").expect(200);
      const r = await get(
        "hrA",
        "/hr/interviews?status=NO_SHOW&limit=100",
      ).expect(200);
      const rows = (r.body as Body<Interview[]>).data;
      expect(rows.map((i) => i.id)).toContain(a.id);
      expect(rows.every((i) => i.status === "NO_SHOW")).toBe(true);
    });

    it("reads one by id; 404 for an unknown id", async () => {
      const r = await get("hrA", `/hr/interviews/${a.id}`).expect(200);
      expect((r.body as Body<Interview>).data.candidateName).toBe(
        "Lakshmi Devi",
      );
      await get("hrA", "/hr/interviews/2000000000").expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  describe("status changes (legacy: any value to any value, no guard)", () => {
    let i: Interview;

    beforeAll(async () => {
      i = (
        (await post("hrA", "/hr/interviews", VALID).expect(201)) as unknown as {
          body: Body<Interview>;
        }
      ).body.data;
    });

    it("moves through every legacy value, including backwards and to the same value", async () => {
      const path = [
        "COMPLETED",
        "SELECTED",
        "NO_SHOW",
        "SCHEDULED",
        "REJECTED",
        "REJECTED",
      ];
      for (const status of path) {
        const r = await setStatus("hrA", i.id, status).expect(200);
        expect((r.body as Body<Interview>).data.status).toBe(status);
        const row = await prisma.interview.findUniqueOrThrow({
          where: { id: i.id },
        });
        expect(row.status).toBe(status);
      }
    });

    it("writes one status_change audit row per change, with before and after", async () => {
      const rows = await prisma.auditLog.findMany({
        where: {
          entityType: "interview",
          entityId: BigInt(i.id),
          action: "status_change",
        },
        orderBy: { id: "asc" },
      });
      expect(rows).toHaveLength(6);
      expect(rows[0]?.before).toEqual({ status: "SCHEDULED" });
      expect(rows[0]?.after).toEqual({ status: "COMPLETED" });
      expect(rows[0]?.actorUserId).toBe(userIds.hrA);
      expect(rows[5]?.before).toEqual({ status: "REJECTED" });
      expect(rows[5]?.after).toEqual({ status: "REJECTED" });
    });

    it("404 and no change for a status update on an unknown id", async () => {
      await setStatus("hrA", 2000000000, "SELECTED").expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  describe("organization isolation and absent operations", () => {
    let a: Interview;

    beforeAll(async () => {
      a = (
        (await post("hrA", "/hr/interviews", VALID).expect(201)) as unknown as {
          body: Body<Interview>;
        }
      ).body.data;
    });

    it("another organization cannot read, list, or change this interview", async () => {
      await get("hrB", `/hr/interviews/${a.id}`).expect(404);
      await setStatus("hrB", a.id, "SELECTED").expect(404);
      const list = await get("hrB", "/hr/interviews?limit=100").expect(200);
      expect(
        (list.body as Body<Interview[]>).data.map((i) => i.id),
      ).not.toContain(a.id);
      const row = await prisma.interview.findUniqueOrThrow({
        where: { id: a.id },
      });
      expect(row.status).toBe("SCHEDULED");
    });

    it("exposes no edit, reschedule or delete route", async () => {
      await request(app.getHttpServer())
        .patch(`/hr/interviews/${a.id}`)
        .set(auth("hrA"))
        .send({ interviewDate: "2026-12-01" })
        .expect(404);
      const del = await request(app.getHttpServer())
        .delete(`/hr/interviews/${a.id}`)
        .set(auth("hrA"));
      expect([404, 405]).toContain(del.status);
      const row = await prisma.interview.findUniqueOrThrow({
        where: { id: a.id },
      });
      expect(row.interviewDate.toISOString().slice(0, 10)).toBe("2026-10-12");
    });
  });

  // ---------------------------------------------------------------------------
  describe("database invariants", () => {
    const row = {
      organizationId: 0,
      candidateName: "x",
      roleTitle: "x",
      interviewerName: "x",
      interviewDate: new Date("2026-10-12T00:00:00Z"),
      interviewTime: "10:00",
      mode: "ONLINE",
      status: "SCHEDULED",
    };

    it("rejects a status outside the legacy set", async () => {
      await expect(
        prisma.interview.create({
          data: { ...row, organizationId: orgA.id, status: "HIRED" },
        }),
      ).rejects.toThrow();
    });

    it("rejects a mode outside the legacy set", async () => {
      await expect(
        prisma.interview.create({
          data: { ...row, organizationId: orgA.id, mode: "ZOOM" },
        }),
      ).rejects.toThrow();
    });

    it("rejects a malformed time", async () => {
      await expect(
        prisma.interview.create({
          data: { ...row, organizationId: orgA.id, interviewTime: "25:99" },
        }),
      ).rejects.toThrow();
    });
  });
});
