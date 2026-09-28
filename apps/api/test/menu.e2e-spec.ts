import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

describe("menu (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;

  let orgA: { id: number; slug: string };
  let fullAccessToken: string;
  let limitedToken: string;

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

    const menuReadPermission = await prisma.permission.upsert({
      where: { code: "menu.item.read" },
      update: {},
      create: { code: "menu.item.read", description: "Read menu items" },
    });
    const menuWritePermission = await prisma.permission.upsert({
      where: { code: "menu.item.write" },
      update: {},
      create: { code: "menu.item.write", description: "Write menu items" },
    });
    const roleWritePermission = await prisma.permission.upsert({
      where: { code: "settings.role.write" },
      update: {},
      create: { code: "settings.role.write", description: "Manage roles" },
    });

    // 1. Role with full permissions
    const fullRole = await prisma.role.create({
      data: {
        organizationId: orgA.id,
        name: `full-role-${suffix}`,
      },
    });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: fullRole.id, permissionId: menuReadPermission.id },
        { roleId: fullRole.id, permissionId: menuWritePermission.id },
        { roleId: fullRole.id, permissionId: roleWritePermission.id },
      ],
    });
    const fullUser = await prisma.user.create({
      data: {
        organizationId: orgA.id,
        email: `full@${suffix}.test`,
        passwordHash,
        fullName: "Full Access User",
      },
    });
    await prisma.userRole.create({
      data: { userId: fullUser.id, roleId: fullRole.id },
    });

    // 2. Role with only menu.item.read (no settings.role.write)
    const limitedRole = await prisma.role.create({
      data: {
        organizationId: orgA.id,
        name: `limited-role-${suffix}`,
      },
    });
    await prisma.rolePermission.createMany({
      data: [{ roleId: limitedRole.id, permissionId: menuReadPermission.id }],
    });
    const limitedUser = await prisma.user.create({
      data: {
        organizationId: orgA.id,
        email: `limited@${suffix}.test`,
        passwordHash,
        fullName: "Limited User",
      },
    });
    await prisma.userRole.create({
      data: { userId: limitedUser.id, roleId: limitedRole.id },
    });

    async function login(email: string): Promise<string> {
      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          organizationSlug: orgA.slug,
          email,
          password: "Password123!",
        })
        .expect(201);
      return (response.body as { data: { accessToken: string } }).data
        .accessToken;
    }

    fullAccessToken = await login(`full@${suffix}.test`);
    limitedToken = await login(`limited@${suffix}.test`);
  });

  afterAll(async () => {
    await prisma.menuItem.deleteMany({
      where: { organizationId: orgA.id },
    });
    await prisma.userRole.deleteMany({
      where: { user: { organizationId: orgA.id } },
    });
    await prisma.rolePermission.deleteMany({
      where: { role: { organizationId: orgA.id } },
    });
    await prisma.role.deleteMany({
      where: { organizationId: orgA.id },
    });
    await prisma.user.deleteMany({
      where: { organizationId: orgA.id },
    });
    await prisma.organization.deleteMany({
      where: { id: orgA.id },
    });
    await app.close();
  });

  it("rejects unauthenticated GET /menu/my-menu with 401", async () => {
    await request(app.getHttpServer()).get("/menu/my-menu").expect(401);
  });

  it("rejects unpermitted write to /menu/items with 403", async () => {
    await request(app.getHttpServer())
      .post("/menu/items")
      .set("Authorization", `Bearer ${limitedToken}`)
      .send({ code: "forbidden-item", label: "Forbidden" })
      .expect(403);
  });

  it("/menu/my-menu filters out restricted items server-side for limited user", async () => {
    // 1. Create a public item (permission = null)
    await request(app.getHttpServer())
      .post("/menu/items")
      .set("Authorization", `Bearer ${fullAccessToken}`)
      .send({
        code: "public-dashboard",
        label: "Public Dashboard",
        path: "/dashboard",
        order: 1,
      })
      .expect(201);

    // 2. Create a restricted item requiring "settings.role.write"
    await request(app.getHttpServer())
      .post("/menu/items")
      .set("Authorization", `Bearer ${fullAccessToken}`)
      .send({
        code: "restricted-security",
        label: "Security Settings",
        path: "/admin/roles",
        permission: "settings.role.write",
        order: 2,
      })
      .expect(201);

    // 3. Limited user calls /menu/my-menu:
    // MUST see "public-dashboard" but MUST NOT see "restricted-security"
    const limitedRes = await request(app.getHttpServer())
      .get("/menu/my-menu")
      .set("Authorization", `Bearer ${limitedToken}`)
      .expect(200);

    const limitedItems = (limitedRes.body as { data: Array<{ code: string }> })
      .data;
    expect(limitedItems.some((i) => i.code === "public-dashboard")).toBe(true);
    expect(limitedItems.some((i) => i.code === "restricted-security")).toBe(
      false,
    );

    // 4. Full access user calls /menu/my-menu:
    // MUST see BOTH "public-dashboard" and "restricted-security"
    const fullRes = await request(app.getHttpServer())
      .get("/menu/my-menu")
      .set("Authorization", `Bearer ${fullAccessToken}`)
      .expect(200);

    const fullItems = (fullRes.body as { data: Array<{ code: string }> }).data;
    expect(fullItems.some((i) => i.code === "public-dashboard")).toBe(true);
    expect(fullItems.some((i) => i.code === "restricted-security")).toBe(true);
  });
});
