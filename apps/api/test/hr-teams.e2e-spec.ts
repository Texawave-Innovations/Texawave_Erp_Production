import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

interface Body<T> {
  data: T;
}

describe("HR teams list (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let org: { id: number; slug: string };
  let otherOrg: { id: number };
  const tokens: Record<string, string> = {};
  const suffix = randomUUID().slice(0, 8);
  const passwordHash = bcrypt.hashSync("Password123!", 10);

  const login = async (email: string) =>
    (
      (
        await request(app.getHttpServer())
          .post("/auth/login")
          .send({ organizationSlug: org.slug, email, password: "Password123!" })
          .expect(201)
      ).body as Body<{ accessToken: string }>
    ).data.accessToken;

  async function mkUser(key: string, codes: string[]) {
    const role = await prisma.role.create({
      data: { organizationId: org.id, name: `teams-${key}-${suffix}` },
    });
    for (const code of codes) {
      const p = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: p.id },
      });
    }
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `${key}-${suffix}@example.com`,
        passwordHash,
        fullName: key,
      },
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });
    tokens[key] = await login(user.email);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    org = await prisma.organization.create({
      data: { name: `Teams Org ${suffix}`, slug: `teams-org-${suffix}` },
    });
    otherOrg = await prisma.organization.create({
      data: { name: `Teams Other ${suffix}`, slug: `teams-other-${suffix}` },
    });
    await prisma.team.createMany({
      data: [
        { organizationId: org.id, name: "Software", code: `SW${suffix}` },
        { organizationId: org.id, name: "Electrical", code: `EL${suffix}` },
        {
          organizationId: org.id,
          name: "Retired",
          code: `RT${suffix}`,
          isActive: false,
        },
        { organizationId: otherOrg.id, name: "Elsewhere", code: `OT${suffix}` },
      ],
    });

    await mkUser("hr", ["hr.employee.write.all"]);
    await mkUser("nobody", []);
  });

  afterAll(async () => {
    await app.close();
  });

  it("401s without a token", async () => {
    await request(app.getHttpServer()).get("/hr/teams").expect(401);
  });

  it("403s a caller without any hr.employee.write scope", async () => {
    await request(app.getHttpServer())
      .get("/hr/teams")
      .set("Authorization", `Bearer ${tokens.nobody}`)
      .expect(403);
  });

  it("lists only active teams of the caller's organization, sorted by name", async () => {
    const res = await request(app.getHttpServer())
      .get("/hr/teams")
      .set("Authorization", `Bearer ${tokens.hr}`)
      .expect(200);
    const teams = (res.body as Body<{ name: string; id: number }[]>).data;
    expect(teams.map((t) => t.name)).toEqual(["Electrical", "Software"]);
    expect(typeof teams[0]?.id).toBe("number");
    expect(teams[0]).toMatchObject({ name: "Electrical", code: `EL${suffix}` });
    expect(teams.some((t) => t.name === "Elsewhere")).toBe(false);
    expect(teams.some((t) => t.name === "Retired")).toBe(false);
  });
});
