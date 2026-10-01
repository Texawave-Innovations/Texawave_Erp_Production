import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

describe("auth (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let org: { id: number; slug: string };
  let token: string;
  let testUser: { id: number; email: string; fullName: string };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const passwordHash = await bcrypt.hash("Password123!", 10);
    const suffix = randomUUID().slice(0, 8);

    org = await prisma.organization.create({
      data: { name: `Auth Org ${suffix}`, slug: `auth-org-${suffix}` },
    });

    const testPerm = await prisma.permission.upsert({
      where: { code: "reference.tags.read" },
      update: {},
      create: {
        code: "reference.tags.read",
        description: "Read tags",
      },
    });

    const role = await prisma.role.create({
      data: {
        organizationId: org.id,
        name: `Auth Role ${suffix}`,
        rolePermissions: {
          create: [{ permissionId: testPerm.id }],
        },
      },
    });

    testUser = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `auth-${suffix}@example.com`,
        fullName: "Auth Tester",
        passwordHash,
        userRoles: {
          create: [{ roleId: role.id }],
        },
      },
    });

    const loginRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        organizationSlug: org.slug,
        email: testUser.email,
        password: "Password123!",
      })
      .expect(201);

    token = (loginRes.body as { data: { accessToken: string } }).data
      .accessToken;
  });

  afterAll(async () => {
    await prisma.userRole.deleteMany({ where: { userId: testUser.id } });
    await prisma.rolePermission.deleteMany({
      where: { role: { organizationId: org.id } },
    });
    await prisma.role.deleteMany({ where: { organizationId: org.id } });
    await prisma.user.deleteMany({ where: { organizationId: org.id } });
    await prisma.organization.delete({ where: { id: org.id } });
    await app.close();
  });

  it("GET /auth/me returns 401 when not authenticated", async () => {
    await request(app.getHttpServer()).get("/auth/me").expect(401);
  });

  it("GET /auth/me returns user details and permissions when authenticated", async () => {
    const res = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const body = res.body as {
      data: {
        userId: number;
        organizationId: number;
        email: string;
        fullName: string;
        roleIds: number[];
        permissions: string[];
      };
    };

    expect(body.data.userId).toBe(testUser.id);
    expect(body.data.organizationId).toBe(org.id);
    expect(body.data.email).toBe(testUser.email);
    expect(body.data.fullName).toBe("Auth Tester");
    expect(body.data.roleIds).toHaveLength(1);
    expect(body.data.permissions).toContain("reference.tags.read");
  });
});
