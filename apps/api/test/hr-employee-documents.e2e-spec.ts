import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

/**
 * HR employee documents (e2e): HR can view documents an employee uploaded
 * during onboarding and upload their own ad-hoc documents for that employee,
 * team-scoped like every other HR data endpoint (Docs/CODING_STANDARDS.md
 * §10a). Also proves the self-service onboarding document flow
 * (/employee/profile/documents/...) is unaffected by the EmployeeDocument
 * schema change this module required (partial unique index + source/label
 * columns — see profile.repository.ts and the migration's comment).
 */
interface Body<T> {
  data: T;
}
interface DocRow {
  id: number;
  employeeId: number;
  documentType: string;
  label: string | null;
  source: "ONBOARDING" | "HR_UPLOADED";
  fileName: string;
}

const HR_PERMS_ALL = [
  "hr.employee.read.all",
  "hr.employee.write.all",
  "hr.employee_document.read.all",
  "hr.employee_document.write.all",
];
const HR_PERMS_TEAM = [
  "hr.employee.read.team",
  "hr.employee_document.read.team",
  "hr.employee_document.write.team",
];
const HR_PERMS = [...HR_PERMS_ALL, ...HR_PERMS_TEAM];
const SELF_SERVICE_PERMS = [
  "employee_self_service.profile.read",
  "employee_self_service.profile.write",
];

describe("HR employee documents (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let org: { id: number; slug: string };
  const tokens: Record<string, string> = {};
  const perm = new Map<string, number>();
  const suffix = randomUUID().slice(0, 8);
  let passwordHash: string;
  let team1: number;
  let team2: number;
  let desig: number;
  let empType: number;
  let empInTeam1: number;
  let selfServiceEmployeeId: number;

  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const get = (who: string, path: string) =>
    request(app.getHttpServer()).get(path).set(auth(who));
  const del = (who: string, path: string) =>
    request(app.getHttpServer()).delete(path).set(auth(who));
  const upload = (
    who: string,
    employeeId: number,
    label: string,
    buffer: Buffer,
    name: string,
  ) =>
    request(app.getHttpServer())
      .post(`/hr/employees/${employeeId}/documents`)
      .set(auth(who))
      .field("label", label)
      .attach("file", buffer, name);
  const PNG_BYTES = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from("fake-image-data"),
  ]);

  async function mkUser(
    key: string,
    codes: string[],
    opts: { teamIds?: number[] } = {},
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
        email: `${key}-${suffix}@example.com`,
        passwordHash,
        fullName: `User ${key}`,
      },
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });
    for (const teamId of opts.teamIds ?? []) {
      await prisma.userTeamAccess.create({
        data: { organizationId: org.id, userId: user.id, teamId },
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
    return user;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    passwordHash = await bcrypt.hash("Password123!", 10);

    org = await prisma.organization.create({
      data: { name: `Doc Org ${suffix}`, slug: `doc-org-${suffix}` },
    });
    for (const code of [...HR_PERMS, ...SELF_SERVICE_PERMS]) {
      const p = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      perm.set(code, p.id);
    }
    const codeSuffix = suffix.toUpperCase().replace(/[^A-Z0-9]/g, "X");
    team1 = (
      await prisma.team.create({
        data: { organizationId: org.id, name: "T1", code: `T1${codeSuffix}` },
      })
    ).id;
    team2 = (
      await prisma.team.create({
        data: { organizationId: org.id, name: "T2", code: `T2${codeSuffix}` },
      })
    ).id;
    desig = (
      await prisma.designation.create({
        data: {
          organizationId: org.id,
          code: `D${codeSuffix}`,
          name: "Engineer",
        },
      })
    ).id;
    empType = (
      await prisma.employmentType.create({
        data: {
          organizationId: org.id,
          code: `FT${codeSuffix}`,
          name: "Full-time",
        },
      })
    ).id;

    empInTeam1 = (
      await prisma.employee.create({
        data: {
          organizationId: org.id,
          employeeCode: `EMP-9${Date.now()}1`,
          fullName: "Team1 Employee",
          teamId: team1,
          designationId: desig,
          employmentTypeId: empType,
          dateOfJoining: new Date("2026-01-05"),
        },
      })
    ).id;

    await mkUser("hrAll", HR_PERMS_ALL);
    await mkUser("hrTeam1", HR_PERMS_TEAM, { teamIds: [team1] });
    await mkUser("hrTeam2", HR_PERMS_TEAM, { teamIds: [team2] });
    await mkUser("noPerm", []);

    // Self-service user for the regression check against
    // employee/profile/documents/... (profile.repository.ts).
    const ssRole = await prisma.role.create({
      data: { organizationId: org.id, name: `role-ss-${suffix}` },
    });
    await prisma.rolePermission.createMany({
      data: SELF_SERVICE_PERMS.map((c) => ({
        roleId: ssRole.id,
        permissionId: perm.get(c) as number,
      })),
    });
    const ssUser = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `ss-${suffix}@example.com`,
        passwordHash,
        fullName: "Self Service Employee",
      },
    });
    await prisma.userRole.create({
      data: { userId: ssUser.id, roleId: ssRole.id },
    });
    const ssEmployee = await prisma.employee.create({
      data: {
        organizationId: org.id,
        employeeCode: `EMP-9${Date.now()}2`,
        fullName: "Self Service Employee",
        userId: ssUser.id,
        teamId: team1,
        designationId: desig,
        employmentTypeId: empType,
        dateOfJoining: new Date("2026-01-05"),
      },
    });
    selfServiceEmployeeId = ssEmployee.id;
    const ssRes = await request(app.getHttpServer())
      .post("/auth/login")
      .send({
        organizationSlug: org.slug,
        email: ssUser.email,
        password: "Password123!",
      })
      .expect(201);
    tokens.selfService = (
      ssRes.body as Body<{ accessToken: string }>
    ).data.accessToken;
  });

  afterAll(async () => {
    await prisma.employeeDocument.deleteMany({
      where: { organizationId: org.id },
    });
    await prisma.employee.deleteMany({ where: { organizationId: org.id } });
    await prisma.userRole.deleteMany({
      where: { user: { organizationId: org.id } },
    });
    await prisma.userTeamAccess.deleteMany({
      where: { organizationId: org.id },
    });
    await prisma.rolePermission.deleteMany({
      where: { role: { organizationId: org.id } },
    });
    await prisma.role.deleteMany({ where: { organizationId: org.id } });
    await prisma.user.deleteMany({ where: { organizationId: org.id } });
    await prisma.employmentType.deleteMany({
      where: { organizationId: org.id },
    });
    await prisma.designation.deleteMany({ where: { organizationId: org.id } });
    await prisma.team.deleteMany({ where: { organizationId: org.id } });
    await prisma.organization.delete({ where: { id: org.id } });
    await app.close();
  });

  it("401s without a token", async () => {
    await request(app.getHttpServer())
      .get(`/hr/employees/${empInTeam1}/documents`)
      .expect(401);
  });

  it("403s without hr.employee_document permissions", async () => {
    await get("noPerm", `/hr/employees/${empInTeam1}/documents`).expect(403);
  });

  it("lists empty for a new employee", async () => {
    const res = await get(
      "hrAll",
      `/hr/employees/${empInTeam1}/documents`,
    ).expect(200);
    expect((res.body as Body<DocRow[]>).data).toEqual([]);
  });

  let uploadedId: number;

  it("uploads an ad-hoc document as HR (source=HR_UPLOADED)", async () => {
    const res = await upload(
      "hrAll",
      empInTeam1,
      "Offer Letter",
      PNG_BYTES,
      "offer.png",
    ).expect(201);
    const doc = (res.body as Body<DocRow>).data;
    expect(doc.source).toBe("HR_UPLOADED");
    expect(doc.label).toBe("Offer Letter");
    uploadedId = doc.id;
  });

  it("allows a second document with the same label (no one-per-type limit for HR uploads)", async () => {
    const res = await upload(
      "hrAll",
      empInTeam1,
      "Offer Letter",
      PNG_BYTES,
      "offer-2.png",
    ).expect(201);
    expect((res.body as Body<DocRow>).data.id).not.toBe(uploadedId);
  });

  it("rejects a non-image/pdf upload", async () => {
    await upload(
      "hrAll",
      empInTeam1,
      "Bad File",
      Buffer.from("not a real file"),
      "bad.txt",
    ).expect(400);
  });

  it("downloads an uploaded document", async () => {
    const res = await get(
      "hrAll",
      `/hr/employees/${empInTeam1}/documents/${uploadedId}/file`,
    ).expect(200);
    expect(res.headers["content-length"]).toBe(String(PNG_BYTES.length));
  });

  it("never returns the storage key", async () => {
    const res = await get(
      "hrAll",
      `/hr/employees/${empInTeam1}/documents`,
    ).expect(200);
    for (const doc of (res.body as Body<Record<string, unknown>[]>).data) {
      expect(doc.storageKey).toBeUndefined();
    }
  });

  it("404s for an employee outside the caller's team scope", async () => {
    await get("hrTeam2", `/hr/employees/${empInTeam1}/documents`).expect(404);
    await upload(
      "hrTeam2",
      empInTeam1,
      "Should Fail",
      PNG_BYTES,
      "x.png",
    ).expect(404);
  });

  it("hrTeam1 (scoped to team1) can see team1's employee", async () => {
    await get("hrTeam1", `/hr/employees/${empInTeam1}/documents`).expect(200);
  });

  it("soft-deletes a document", async () => {
    await del(
      "hrAll",
      `/hr/employees/${empInTeam1}/documents/${uploadedId}`,
    ).expect(204);
    const res = await get(
      "hrAll",
      `/hr/employees/${empInTeam1}/documents`,
    ).expect(200);
    const ids = (res.body as Body<DocRow[]>).data.map((d) => d.id);
    expect(ids).not.toContain(uploadedId);
  });

  it("404s deleting an already-deleted document", async () => {
    await del(
      "hrAll",
      `/hr/employees/${empInTeam1}/documents/${uploadedId}`,
    ).expect(404);
  });

  describe("regression: self-service onboarding document flow is unaffected", () => {
    const putOwnDocument = (
      documentType: string,
      buffer: Buffer,
      name: string,
    ) =>
      request(app.getHttpServer())
        .put(`/employee/profile/documents/${documentType}/file`)
        .set(auth("selfService"))
        .attach("file", buffer, name);

    it("uploads, re-uploads (upsert), lists, downloads and deletes one's own onboarding document", async () => {
      await putOwnDocument("AADHAAR", PNG_BYTES, "aadhaar.png").expect(200);

      // Re-upload replaces the same row rather than creating a second one —
      // this is exactly the upsert-by-type behavior profile.repository.ts's
      // getDocument/upsertDocumentFile must still provide after dropping the
      // DB-level compound unique key in favor of a partial index.
      await putOwnDocument("AADHAAR", PNG_BYTES, "aadhaar-v2.png").expect(200);

      const list = await request(app.getHttpServer())
        .get("/employee/profile/documents")
        .set(auth("selfService"))
        .expect(200);
      const docs = (list.body as Body<DocRow[]>).data;
      const aadhaarRows = docs.filter((d) => d.documentType === "AADHAAR");
      expect(aadhaarRows).toHaveLength(1);
      expect(aadhaarRows[0]?.source).toBe("ONBOARDING");

      await request(app.getHttpServer())
        .get("/employee/profile/documents/AADHAAR/file")
        .set(auth("selfService"))
        .expect(200);

      await request(app.getHttpServer())
        .delete("/employee/profile/documents/AADHAAR")
        .set(auth("selfService"))
        .expect(204);

      const afterDelete = await request(app.getHttpServer())
        .get("/employee/profile/documents")
        .set(auth("selfService"))
        .expect(200);
      expect(
        (afterDelete.body as Body<DocRow[]>).data.filter(
          (d) => d.documentType === "AADHAAR",
        ),
      ).toHaveLength(0);
    });

    it("employee's own document list never includes HR-uploaded documents", async () => {
      await upload(
        "hrAll",
        selfServiceEmployeeId,
        "Internal Note",
        PNG_BYTES,
        "note.png",
      ).expect(201);

      const list = await request(app.getHttpServer())
        .get("/employee/profile/documents")
        .set(auth("selfService"))
        .expect(200);
      const labels = (list.body as Body<DocRow[]>).data.map((d) => d.label);
      expect(labels).not.toContain("Internal Note");
    });
  });
});
