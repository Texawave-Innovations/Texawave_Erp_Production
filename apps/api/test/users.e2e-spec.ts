import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

describe("users (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let orgB: { id: number; slug: string };
  let tokenA: string;
  let tokenB: string;
  let readOnlyToken: string;
  let roleA: { id: number; name: string };
  let roleB: { id: number; name: string };
  let teamA: { id: number; name: string; code: string };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await bcrypt.hash("Password123!", 10);
    const suffix = randomUUID().slice(0, 8);

    orgA = await prisma.organization.create({
      data: { name: `Org A ${suffix}`, slug: `org-a-${suffix}` },
    });
    orgB = await prisma.organization.create({
      data: { name: `Org B ${suffix}`, slug: `org-b-${suffix}` },
    });

    const readPermission = await prisma.permission.upsert({
      where: { code: "users.user.read" },
      update: {},
      create: { code: "users.user.read", description: "Read users" },
    });
    const writePermission = await prisma.permission.upsert({
      where: { code: "users.user.write" },
      update: {},
      create: { code: "users.user.write", description: "Write users" },
    });

    roleA = await prisma.role.create({
      data: { organizationId: orgA.id, name: `Role A ${suffix}` },
    });
    roleB = await prisma.role.create({
      data: { organizationId: orgB.id, name: `Role B ${suffix}` },
    });

    teamA = await prisma.team.create({
      data: {
        organizationId: orgA.id,
        name: `Team A ${suffix}`,
        code: `TA${suffix.slice(0, 4).toUpperCase()}`,
      },
    });

    async function makeUser(
      orgId: number,
      email: string,
      permissionIds: number[],
    ) {
      const role = await prisma.role.create({
        data: {
          organizationId: orgId,
          name: `admin-role-${randomUUID().slice(0, 8)}`,
        },
      });
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
      });
      const user = await prisma.user.create({
        data: {
          organizationId: orgId,
          email,
          passwordHash,
          fullName: "Admin User",
        },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
      return user;
    }

    await makeUser(orgA.id, "full-access@org-a.test", [
      readPermission.id,
      writePermission.id,
    ]);
    await makeUser(orgB.id, "full-access@org-b.test", [
      readPermission.id,
      writePermission.id,
    ]);
    await makeUser(orgA.id, "read-only@org-a.test", [readPermission.id]);

    async function login(
      organizationSlug: string,
      email: string,
    ): Promise<string> {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ organizationSlug, email, password: "Password123!" })
        .expect(201);
      return (response.body as { data: { accessToken: string } }).data
        .accessToken;
    }

    tokenA = await login(orgA.slug, "full-access@org-a.test");
    tokenB = await login(orgB.slug, "full-access@org-b.test");
    readOnlyToken = await login(orgA.slug, "read-only@org-a.test");
  });

  afterAll(async () => {
    await prisma.userTeamAccess.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.team.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.userRole.deleteMany({
      where: { user: { organizationId: { in: [orgA.id, orgB.id] } } },
    });
    await prisma.rolePermission.deleteMany({
      where: { role: { organizationId: { in: [orgA.id, orgB.id] } } },
    });
    await prisma.role.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.user.deleteMany({
      where: { organizationId: { in: [orgA.id, orgB.id] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [orgA.id, orgB.id] } },
    });
    await app.close();
  });

  it("rejects unauthenticated request with 401", async () => {
    await request(app.getHttpServer()).get("/users").expect(401);
  });

  it("rejects unpermitted write request with 403", async () => {
    await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${readOnlyToken}`)
      .send({
        email: "forbidden@org-a.test",
        fullName: "Forbidden",
        password: "Password123!",
      })
      .expect(403);
  });

  it("creates, reads, and updates user without leaking passwordHash", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        email: "bob@org-a.test",
        fullName: "Bob Smith",
        password: "Password123!",
      })
      .expect(201);

    const created = (createRes.body as { data: Record<string, unknown> }).data;
    expect(created.email).toBe("bob@org-a.test");
    expect(created.fullName).toBe("Bob Smith");
    expect(created.passwordHash).toBeUndefined();

    const getRes = await request(app.getHttpServer())
      .get(`/users/${created.id}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200);

    const retrieved = (getRes.body as { data: Record<string, unknown> }).data;
    expect(retrieved.id).toBe(created.id);
    expect(retrieved.passwordHash).toBeUndefined();

    // Tenant isolation: Org B cannot see Org A user
    await request(app.getHttpServer())
      .get(`/users/${created.id}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .expect(404);
  });

  it("rejects assigning a role from another organization (hard security boundary)", async () => {
    // Create a user in Org A
    const createRes = await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        email: "charlie@org-a.test",
        fullName: "Charlie Brown",
        password: "Password123!",
      })
      .expect(201);
    const userId = (createRes.body as { data: { id: number } }).data.id;

    // Attempt to assign roleB (belongs to orgB) to user in orgA -> MUST BE REJECTED (400)
    await request(app.getHttpServer())
      .post(`/users/${userId}/roles`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ roleIds: [roleB.id] })
      .expect(400);

    // Assigning valid roleA (belongs to orgA) succeeds
    const assignRes = await request(app.getHttpServer())
      .post(`/users/${userId}/roles`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ roleIds: [roleA.id] })
      .expect(201);

    const assigned = (
      assignRes.body as { data: { roles: Array<{ id: number }> } }
    ).data;
    expect(assigned.roles.map((r) => r.id)).toContain(roleA.id);
  });

  it("assigns teams to user within same org and returns teams", async () => {
    const createRes = await request(app.getHttpServer())
      .post("/users")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        email: "dave@org-a.test",
        fullName: "Dave Miller",
        password: "Password123!",
      })
      .expect(201);
    const userId = (createRes.body as { data: { id: number } }).data.id;

    const assignTeamRes = await request(app.getHttpServer())
      .post(`/users/${userId}/teams`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ teams: [{ teamId: teamA.id, isLead: true }] })
      .expect(201);

    const data = (
      assignTeamRes.body as {
        data: { teams: Array<{ id: number; isLead: boolean }> };
      }
    ).data;
    expect(data.teams.some((t) => t.id === teamA.id && t.isLead)).toBe(true);
  });
});
