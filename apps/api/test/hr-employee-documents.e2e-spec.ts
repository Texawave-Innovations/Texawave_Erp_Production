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
  let redis: Redis;
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
    redis = app.get<Redis>(REDIS_CLIENT);
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
    // Reads employees org-wide but may only write documents for team2.
    await mkUser(
      "hrMixed",
      ["hr.employee.read.all", "hr.employee_document.write.team"],
      { teamIds: [team2] },
    );

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
    await prisma.employmentType.deleteMany({
      where: { organizationId: org.id },
    });
    await prisma.designation.deleteMany({ where: { organizationId: org.id } });
    await prisma.team.deleteMany({ where: { organizationId: org.id } });
    // Users and the organization stay: this suite writes audit rows, and
    // audit_logs is append-only with an FK to the actor (test/README.md).
    const users = await prisma.user.findMany({
      where: { organizationId: org.id },
      select: { id: true },
    });
    await Promise.all(
      users.flatMap(({ id }) => [
        redis.del(`permissions:${id}`),
        redis
          .keys(`refresh:${id}:*`)
          .then((k) => (k.length ? redis.del(k) : 0)),
      ]),
    );
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

  describe("Batch 1: removal, upload validation and audit", () => {
    const auditRows = (entityId: number, action: string) =>
      prisma.auditLog.findMany({
        where: {
          organizationId: org.id,
          entityType: "employee_document",
          entityId: BigInt(entityId),
          action,
        },
      });

    it("EMP-8: HR cannot delete a document the employee submitted during onboarding", async () => {
      const onboarding = await prisma.employeeDocument.create({
        data: {
          organizationId: org.id,
          teamId: team1,
          employeeId: empInTeam1,
          documentType: "AADHAAR",
          source: "ONBOARDING",
          fileName: "aadhaar.png",
          storageKey: `${empInTeam1}/onboarding-${suffix}.png`,
          mimeType: "image/png",
          sizeBytes: 10,
        },
      });
      const res = await del(
        "hrAll",
        `/hr/employees/${empInTeam1}/documents/${onboarding.id}`,
      ).expect(422);
      expect((res.body as { error: string }).error).toBe(
        "ONBOARDING_DOCUMENT_NOT_REMOVABLE",
      );
      const after = await prisma.employeeDocument.findUnique({
        where: { id: onboarding.id },
      });
      expect(after?.deletedAt).toBeNull();
      expect(await auditRows(onboarding.id, "delete_document")).toHaveLength(0);
    });

    it("EMP-9: rejects a documentType outside the fixed set", async () => {
      await request(app.getHttpServer())
        .post(`/hr/employees/${empInTeam1}/documents`)
        .set(auth("hrAll"))
        .field("label", "Odd")
        .field("documentType", "NOT_A_TYPE")
        .attach("file", PNG_BYTES, "odd.png")
        .expect(400);
    });

    it("EMP-9: rejects a label that spells a reserved type when no type is given", async () => {
      await upload(
        "hrAll",
        empInTeam1,
        "profile_photo",
        PNG_BYTES,
        "p.png",
      ).expect(400);
    });

    it("EMP-9: still accepts PROFILE_PHOTO as the document type (HR avatar upload)", async () => {
      const res = await request(app.getHttpServer())
        .post(`/hr/employees/${empInTeam1}/documents`)
        .set(auth("hrAll"))
        .field("label", "Profile photo")
        .field("documentType", "PROFILE_PHOTO")
        .attach("file", PNG_BYTES, "me.png")
        .expect(201);
      expect((res.body as Body<DocRow>).data.documentType).toBe(
        "PROFILE_PHOTO",
      );
    });

    it("EMP-9: a team-scoped document writer cannot upload into another team even with org-wide employee read", async () => {
      await upload(
        "hrMixed",
        empInTeam1,
        "Cross team",
        PNG_BYTES,
        "x.png",
      ).expect(404);
      const rows = await prisma.employeeDocument.findMany({
        where: { employeeId: empInTeam1, label: "Cross team" },
      });
      expect(rows).toHaveLength(0);
    });

    it("EMP-16: upload, download and delete each write an audit row with no file name, label or contents", async () => {
      const up = await upload(
        "hrAll",
        empInTeam1,
        "Audit Subject Label",
        PNG_BYTES,
        "secret-name.png",
      ).expect(201);
      const id = (up.body as Body<DocRow>).data.id;

      await get(
        "hrAll",
        `/hr/employees/${empInTeam1}/documents/${id}/file`,
      ).expect(200);
      await del("hrAll", `/hr/employees/${empInTeam1}/documents/${id}`).expect(
        204,
      );

      for (const action of [
        "upload_document",
        "download_document",
        "delete_document",
      ]) {
        const rows = await auditRows(id, action);
        expect(rows).toHaveLength(1);
        const row = rows[0];
        expect(row?.actorUserId).not.toBeNull();
        const meta = JSON.stringify([row?.before, row?.after, row?.reason]);
        expect(meta).not.toContain("secret-name");
        expect(meta).not.toContain("Audit Subject Label");
        expect(meta).not.toContain("storageKey");
      }
    });

    describe("replacing a document's file", () => {
      const replace = (
        who: string,
        employeeId: number,
        id: number,
        buffer: Buffer,
        name: string,
      ) =>
        request(app.getHttpServer())
          .put(`/hr/employees/${employeeId}/documents/${id}/file`)
          .set(auth(who))
          .attach("file", buffer, name);
      const PNG_V2 = Buffer.concat([PNG_BYTES, Buffer.from("-second-version")]);

      it("swaps the file of an HR-uploaded document and keeps its id, label and source", async () => {
        const up = await upload(
          "hrAll",
          empInTeam1,
          "Replace Me",
          PNG_BYTES,
          "v1.png",
        ).expect(201);
        const id = (up.body as Body<DocRow>).data.id;
        const before = await prisma.employeeDocument.findUniqueOrThrow({
          where: { id },
        });

        const res = await replace(
          "hrAll",
          empInTeam1,
          id,
          PNG_V2,
          "v2.png",
        ).expect(200);
        const doc = (res.body as Body<DocRow>).data;
        expect(doc.id).toBe(id);
        expect(doc.label).toBe("Replace Me");
        expect(doc.source).toBe("HR_UPLOADED");
        expect(doc.fileName).toBe("v2.png");
        expect(JSON.stringify(res.body)).not.toContain("storageKey");

        const after = await prisma.employeeDocument.findUniqueOrThrow({
          where: { id },
        });
        expect(after.storageKey).not.toBe(before.storageKey);
        expect(after.sizeBytes).toBe(PNG_V2.length);

        const file = await get(
          "hrAll",
          `/hr/employees/${empInTeam1}/documents/${id}/file`,
        ).expect(200);
        expect(Buffer.from(file.body as Buffer).equals(PNG_V2)).toBe(true);
      });

      it("lets HR replace a document the employee submitted during onboarding", async () => {
        const onboarding = await prisma.employeeDocument.create({
          data: {
            organizationId: org.id,
            teamId: team1,
            employeeId: empInTeam1,
            documentType: "CERT_12TH",
            source: "ONBOARDING",
            fileName: "old.png",
            storageKey: `${empInTeam1}/onboarding-replace-${suffix}.png`,
            mimeType: "image/png",
            sizeBytes: 10,
          },
        });
        await replace(
          "hrAll",
          empInTeam1,
          onboarding.id,
          PNG_V2,
          "new.png",
        ).expect(200);
        const after = await prisma.employeeDocument.findUniqueOrThrow({
          where: { id: onboarding.id },
        });
        expect(after.source).toBe("ONBOARDING");
        expect(after.documentType).toBe("CERT_12TH");
        expect(after.fileName).toBe("new.png");
        expect(after.deletedAt).toBeNull();
      });

      it("rejects a non-PDF/JPG/PNG replacement and leaves the document unchanged", async () => {
        const up = await upload(
          "hrAll",
          empInTeam1,
          "Keep Me",
          PNG_BYTES,
          "keep.png",
        ).expect(201);
        const id = (up.body as Body<DocRow>).data.id;
        const before = await prisma.employeeDocument.findUniqueOrThrow({
          where: { id },
        });
        await replace(
          "hrAll",
          empInTeam1,
          id,
          Buffer.from("not a real file"),
          "x.txt",
        ).expect(400);
        const after = await prisma.employeeDocument.findUniqueOrThrow({
          where: { id },
        });
        expect(after.storageKey).toBe(before.storageKey);
        expect(after.fileName).toBe("keep.png");
      });

      it("404s for a deleted document and for another team's employee", async () => {
        const up = await upload(
          "hrAll",
          empInTeam1,
          "Gone Soon",
          PNG_BYTES,
          "g.png",
        ).expect(201);
        const id = (up.body as Body<DocRow>).data.id;
        await replace("hrMixed", empInTeam1, id, PNG_V2, "cross.png").expect(
          404,
        );
        await del(
          "hrAll",
          `/hr/employees/${empInTeam1}/documents/${id}`,
        ).expect(204);
        await replace("hrAll", empInTeam1, id, PNG_V2, "late.png").expect(404);
      });

      it("writes one replace_document audit row with no file name, label or contents", async () => {
        const up = await upload(
          "hrAll",
          empInTeam1,
          "Audit Replace Label",
          PNG_BYTES,
          "orig-secret.png",
        ).expect(201);
        const id = (up.body as Body<DocRow>).data.id;
        await replace(
          "hrAll",
          empInTeam1,
          id,
          PNG_V2,
          "replacement-secret.png",
        ).expect(200);
        const rows = await auditRows(id, "replace_document");
        expect(rows).toHaveLength(1);
        expect(rows[0]?.actorUserId).not.toBeNull();
        const meta = JSON.stringify([
          rows[0]?.before,
          rows[0]?.after,
          rows[0]?.reason,
        ]);
        for (const secret of [
          "orig-secret",
          "replacement-secret",
          "Audit Replace Label",
          "storageKey",
        ]) {
          expect(meta).not.toContain(secret);
        }
      });
    });

    it("EMP-16: a download that fails (missing/out-of-scope document) writes no audit row", async () => {
      await get(
        "hrAll",
        `/hr/employees/${empInTeam1}/documents/99999999/file`,
      ).expect(404);
      expect(await auditRows(99999999, "download_document")).toHaveLength(0);
    });
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
