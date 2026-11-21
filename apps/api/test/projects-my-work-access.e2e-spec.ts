import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import request from "supertest";
import * as bcrypt from "bcrypt";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

/**
 * Who may use My Work: an employee through `employee_self_service.work.write`,
 * or anyone holding the original `projects.timer.write`. Either one is enough
 * (`@RequireAnyPermission`), so the self-service code never took access from an
 * existing holder; a user with neither — even with other self-service
 * permissions such as the timesheet's — is refused. Own-data routes only.
 */
const ROUTES = [
  "/projects/tasks/my-work",
  "/projects/tasks/timer/active",
  "/projects/tasks/time-summary/me",
] as const;

describe("My Work access (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};

  const get = (url: string, who: string) =>
    request(app.getHttpServer())
      .get(url)
      .set("Authorization", `Bearer ${tokens[who]}`);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const suffix = randomUUID().slice(0, 8);
    const passwordHash = await bcrypt.hash("Password123!", 10);
    const org = await prisma.organization.create({
      data: { name: `Org MWA ${suffix}`, slug: `my-work-access-${suffix}` },
    });
    const designation = await prisma.designation.create({
      data: { organizationId: org.id, code: "ENG", name: "Engineer" },
    });
    const empType = await prisma.employmentType.create({
      data: { organizationId: org.id, code: "PERM", name: "Permanent" },
    });
    const team = await prisma.team.create({
      data: {
        organizationId: org.id,
        code: `T-${suffix}`,
        name: `Team ${suffix}`,
      },
    });

    const people: Record<string, string[]> = {
      selfService: ["employee_self_service.work.write"],
      projects: ["projects.timer.write"],
      timesheetOnly: [
        "employee_self_service.timesheet.write",
        "employee_self_service.timesheet.read",
      ],
    };

    for (const [key, codes] of Object.entries(people)) {
      const role = await prisma.role.create({
        data: { organizationId: org.id, name: `role-${key}-${suffix}` },
      });
      for (const code of codes) {
        const perm = await prisma.permission.upsert({
          where: { code },
          update: {},
          create: { code, description: code },
        });
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: perm.id },
        });
      }
      const email = `${key}@mwa-${suffix}.test`;
      const user = await prisma.user.create({
        data: {
          organizationId: org.id,
          email,
          passwordHash,
          fullName: key,
        },
      });
      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id },
      });
      await prisma.employee.create({
        data: {
          organization: { connect: { id: org.id } },
          user: { connect: { id: user.id } },
          team: { connect: { id: team.id } },
          employeeCode: `EMP-${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`,
          fullName: key,
          workEmail: email,
          designation: { connect: { id: designation.id } },
          employmentType: { connect: { id: empType.id } },
          dateOfJoining: new Date("2026-01-01T00:00:00Z"),
        },
      });
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({ organizationSlug: org.slug, email, password: "Password123!" })
        .expect(201);
      tokens[key] = (
        res.body as { data: { accessToken: string } }
      ).data.accessToken;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(ROUTES)(
    "%s is open to an employee with employee_self_service.work.write alone",
    async (url) => {
      await get(url, "selfService").expect(200);
    },
  );

  it.each(ROUTES)(
    "%s stays open to a holder of projects.timer.write alone",
    async (url) => {
      await get(url, "projects").expect(200);
    },
  );

  it.each(ROUTES)(
    "%s is refused to a user with neither (the timesheet permissions do not open it)",
    async (url) => {
      const res = await get(url, "timesheetOnly").expect(403);
      expect(JSON.stringify(res.body)).toContain(
        "employee_self_service.work.write or projects.timer.write",
      );
    },
  );
});
