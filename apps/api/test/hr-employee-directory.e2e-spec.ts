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
 * HR → Employees directory additions (Docs/HR_API.md, Employees):
 * probation/confirmation/referral/work-domain fields, phone uniqueness,
 * stats, CSV export (own permission) and CSV import (all-or-nothing, same
 * scope rules as create), and HR's review of a submitted onboarding profile
 * (approve / send back) — each with its permission and team-scope matrix.
 */
interface Body<T> {
  data: T;
}
interface Employee {
  id: number;
  employeeCode: string;
  version: number;
  onboardingStatus: string;
  onboardingReviewStatus: string;
  onboardingReviewNote: string | null;
  probationEndDate: string | null;
  confirmationDate: string | null;
  referredBy: string | null;
  workDomain: string | null;
}

const PERMS = [
  "hr.employee.read.own",
  "hr.employee.read.team",
  "hr.employee.read.all",
  "hr.employee.write.own",
  "hr.employee.write.team",
  "hr.employee.write.all",
  "hr.employee.export.own",
  "hr.employee.export.team",
  "hr.employee.export.all",
  "hr.employee_onboarding.approve.own",
  "hr.employee_onboarding.approve.team",
  "hr.employee_onboarding.approve.all",
  "employee_self_service.profile.read",
  "employee_self_service.profile.write",
];

describe("HR employee directory (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let redis: Redis;
  let org: { id: number; slug: string };
  let otherOrg: { id: number; slug: string };
  const tokens: Record<string, string> = {};
  const userIds: Record<string, number> = {};
  const perm = new Map<string, number>();
  const suffix = randomUUID()
    .slice(0, 6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "X");
  let team1 = 0;
  let team2 = 0;
  let otherTeam = 0;
  let desig = 0;
  let empType = 0;
  let otherDesig = 0;
  let otherEmpType = 0;

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });
  const http = () => request(app.getHttpServer());
  const get = (who: string, path: string) => http().get(path).set(auth(who));
  const post = (who: string, path: string, body: object = {}) =>
    http().post(path).set(auth(who)).send(body);
  const patchReq = (who: string, path: string, body: object) =>
    http().patch(path).set(auth(who)).send(body);
  const data = <T>(res: { body: unknown }) => (res.body as Body<T>).data;
  const errorOf = (res: { body: unknown }) =>
    (res.body as { error?: string }).error;
  const text = (res: request.Response) =>
    Buffer.isBuffer(res.body)
      ? res.body.toString("utf8")
      : (res.text ?? String(res.body));
  const binary = (req: request.Test) =>
    req.buffer(true).parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => done(null, Buffer.concat(chunks)));
    });
  const upload = (who: string, csv: string, query = "") =>
    http()
      .post(`/hr/employees/import${query}`)
      .set(auth(who))
      .attach("file", Buffer.from(csv, "utf8"), "employees.csv");

  async function mkUser(
    o: { id: number; slug: string },
    key: string,
    codes: string[],
    opts: { teamIds?: number[]; employeeId?: number } = {},
  ) {
    const role = await prisma.role.create({
      data: { organizationId: o.id, name: `role-${key}-${suffix}` },
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
        organizationId: o.id,
        email: `${key}@${o.slug}.test`,
        passwordHash: await bcrypt.hash("Password123!", 10),
        fullName: `User ${key}`,
      },
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });
    for (const teamId of opts.teamIds ?? []) {
      await prisma.userTeamAccess.create({
        data: { organizationId: o.id, userId: user.id, teamId },
      });
    }
    if (opts.employeeId) {
      await prisma.employee.update({
        where: { id: opts.employeeId },
        data: { userId: user.id },
      });
    }
    const login = await http().post("/auth/login").send({
      organizationSlug: o.slug,
      email: user.email,
      password: "Password123!",
    });
    expect(login.status).toBe(201);
    tokens[key] = data<{ accessToken: string }>(login).accessToken;
    userIds[key] = user.id;
  }

  async function createEmployee(
    who: string,
    body: Record<string, unknown> = {},
  ): Promise<Employee> {
    const res = await post(who, "/hr/employees", {
      fullName: `Person ${randomUUID().slice(0, 4)}`,
      teamId: team1,
      designationId: desig,
      employmentTypeId: empType,
      dateOfJoining: "2026-10-01",
      ...body,
    }).expect(201);
    return data<Employee>(res);
  }

  /** Every record the completeness check needs, seeded directly. */
  async function seedCompleteProfile(employeeId: number, teamId: number) {
    const owner = { organizationId: org.id, teamId, employeeId };
    const n = String(employeeId).padStart(4, "0");
    await prisma.employeePersonalDetail.upsert({
      where: { employeeId },
      update: {},
      create: {
        ...owner,
        dateOfBirth: new Date("1995-05-05T00:00:00Z"),
        gender: "FEMALE",
        emergencyContactName: "Kin",
        emergencyContactRelation: "Sister",
        emergencyContactPhone: "9876543210",
        fatherName: "Father",
        fatherPhone: "9876543211",
        motherName: "Mother",
        motherPhone: "9876543212",
      },
    });
    await prisma.employeeAddress.create({
      data: {
        ...owner,
        addressType: "PERMANENT",
        addressLine: "1 Road",
        district: "Chennai",
        city: "Chennai",
        state: "Tamil Nadu",
        pincode: "600001",
      },
    });
    await prisma.employeeBankDetail.create({
      data: {
        ...owner,
        accountHolderName: "Holder",
        accountNumberEncrypted: "00:00:00",
        accountNumberMasked: "XXXX1234",
        ifsc: "SBIN0001234",
        bankName: "SBI",
      },
    });
    await prisma.employeeGovernmentId.create({
      data: {
        ...owner,
        aadhaarNumber: `91234567${n}`,
        panNumber: `ABCDE${n}Z`,
      },
    });
    for (const documentType of [
      "PROFILE_PHOTO",
      "AADHAAR",
      "PAN",
      "BANK_STATEMENT",
      "CERT_10TH",
      "CERT_12TH",
      "CERT_GRADUATION",
    ]) {
      await prisma.employeeDocument.create({
        data: {
          ...owner,
          documentType,
          fileName: `${documentType}.pdf`,
          storageKey: `e2e/${randomUUID()}`,
        },
      });
    }
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    redis = app.get<Redis>(REDIS_CLIENT);

    org = await prisma.organization.create({
      data: { name: `Dir ${suffix}`, slug: `dir-${suffix.toLowerCase()}` },
    });
    otherOrg = await prisma.organization.create({
      data: { name: `Dir B ${suffix}`, slug: `dir-b-${suffix.toLowerCase()}` },
    });
    for (const code of PERMS) {
      const p = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      perm.set(code, p.id);
    }
    const mkTeam = async (orgId: number, name: string) =>
      (
        await prisma.team.create({
          data: { organizationId: orgId, name, code: `${name}${suffix}` },
        })
      ).id;
    team1 = await mkTeam(org.id, "Software");
    team2 = await mkTeam(org.id, "Mechanical");
    otherTeam = await mkTeam(otherOrg.id, "Software");
    desig = (
      await prisma.designation.create({
        data: { organizationId: org.id, code: "ENG", name: "Engineer" },
      })
    ).id;
    empType = (
      await prisma.employmentType.create({
        data: { organizationId: org.id, code: "PERM", name: "Permanent" },
      })
    ).id;
    otherDesig = (
      await prisma.designation.create({
        data: { organizationId: otherOrg.id, code: "ENG", name: "Engineer" },
      })
    ).id;
    otherEmpType = (
      await prisma.employmentType.create({
        data: { organizationId: otherOrg.id, code: "PERM", name: "Permanent" },
      })
    ).id;
    await prisma.workLocation.create({
      data: { organizationId: org.id, code: "OMR", name: "OMR Office" },
    });

    await mkUser(org, "hr", [
      "hr.employee.read.all",
      "hr.employee.write.all",
      "hr.employee.export.all",
      "hr.employee_onboarding.approve.all",
    ]);
    await mkUser(org, "reader", ["hr.employee.read.all"]);
    await mkUser(
      org,
      "lead1",
      [
        "hr.employee.read.team",
        "hr.employee.write.team",
        "hr.employee.export.team",
        "hr.employee_onboarding.approve.team",
      ],
      { teamIds: [team1] },
    );
    await mkUser(org, "nobody", []);
    await mkUser(otherOrg, "hrB", [
      "hr.employee.read.all",
      "hr.employee.write.all",
    ]);
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
  describe("new employee fields", () => {
    it("creates and returns probation, confirmation, referral and work domain", async () => {
      const e = await createEmployee("hr", {
        probationEndDate: "2027-04-01",
        confirmationDate: "2027-04-02",
        referredBy: "Ravi (EMP-000012)",
        workDomain: "Embedded",
      });
      expect(e).toMatchObject({
        probationEndDate: "2027-04-01",
        confirmationDate: "2027-04-02",
        referredBy: "Ravi (EMP-000012)",
        workDomain: "Embedded",
        onboardingReviewStatus: "NOT_SUBMITTED",
      });
    });

    it("422 for probation or confirmation before the joining date", async () => {
      const res = await post("hr", "/hr/employees", {
        fullName: "Too Early",
        teamId: team1,
        designationId: desig,
        employmentTypeId: empType,
        dateOfJoining: "2026-10-01",
        probationEndDate: "2026-09-30",
      }).expect(422);
      expect(errorOf(res)).toBe("PROBATION_BEFORE_JOINING");
      const e = await createEmployee("hr");
      const upd = await patchReq("hr", `/hr/employees/${e.id}`, {
        version: e.version,
        confirmationDate: "2026-01-01",
      }).expect(422);
      expect(errorOf(upd)).toBe("CONFIRMATION_BEFORE_JOINING");
    });

    it("only an organization-wide writer may change probation and confirmation", async () => {
      const e = await createEmployee("hr");
      await patchReq("lead1", `/hr/employees/${e.id}`, {
        version: e.version,
        probationEndDate: "2027-01-01",
      }).expect(403);
      const ok = await patchReq("lead1", `/hr/employees/${e.id}`, {
        version: e.version,
        workDomain: "Firmware",
      }).expect(200);
      expect(data<Employee>(ok).workDomain).toBe("Firmware");
    });
  });

  // ---------------------------------------------------------------------------
  describe("phone uniqueness", () => {
    it("409 for a phone another employee has, compared by digits; other organizations are separate", async () => {
      await createEmployee("hr", { phone: "+91 90000 11111" });
      const res = await post("hr", "/hr/employees", {
        fullName: "Same Phone",
        phone: "+91-9000011111",
        teamId: team1,
        designationId: desig,
        employmentTypeId: empType,
        dateOfJoining: "2026-10-01",
      }).expect(409);
      expect((res.body as { message?: string }).message).toMatch(/phone/);
      await post("hrB", "/hr/employees", {
        fullName: "Other Org",
        phone: "+91 90000 11111",
        teamId: otherTeam,
        designationId: otherDesig,
        employmentTypeId: otherEmpType,
        dateOfJoining: "2026-10-01",
      }).expect(201);
    });
  });

  // ---------------------------------------------------------------------------
  describe("stats", () => {
    it("counts within the caller's scope", async () => {
      await createEmployee("hr", { teamId: team2 });
      const all = data<{
        total: number;
        byStatus: Record<string, number>;
        onboarding: { profileIncomplete: number };
        byTeam: Array<{ teamId: number; count: number }>;
      }>(await get("hr", "/hr/employees/stats").expect(200));
      const dbTotal = await prisma.employee.count({
        where: { organizationId: org.id, deletedAt: null },
      });
      expect(all.total).toBe(dbTotal);
      expect(all.byStatus.ACTIVE).toBe(dbTotal);
      expect(all.onboarding.profileIncomplete).toBe(dbTotal);
      expect(all.byTeam.map((t) => t.teamId).sort()).toEqual(
        [team1, team2].sort(),
      );

      const team = data<{ total: number; byTeam: Array<{ teamId: number }> }>(
        await get("lead1", "/hr/employees/stats").expect(200),
      );
      expect(team.byTeam.map((t) => t.teamId)).toEqual([team1]);
      expect(team.total).toBe(
        await prisma.employee.count({
          where: { organizationId: org.id, teamId: team1, deletedAt: null },
        }),
      );
    });

    it("403 without a read permission", async () => {
      await get("nobody", "/hr/employees/stats").expect(403);
    });
  });

  // ---------------------------------------------------------------------------
  describe("CSV export", () => {
    it("needs its own permission: reading the directory is not enough", async () => {
      await get("reader", "/hr/employees/export").expect(403);
      await get("nobody", "/hr/employees/export").expect(403);
    });

    it("returns a CSV of the scoped, filtered rows with formula-like text neutralised", async () => {
      await createEmployee("hr", {
        fullName: "=HYPERLINK(evil)",
        teamId: team2,
      });
      const res = await binary(get("hr", "/hr/employees/export")).expect(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.headers["content-disposition"]).toMatch(/employees-.*\.csv/);
      const csv = text(res);
      expect(csv.split("\r\n")[0]).toBe(
        "\uFEFFEmployee Code,Full Name,Work Email,Phone,Team,Department,Designation,Employment Type,Work Location,Reports To,Date of Joining,Probation End Date,Confirmation Date,Referred By,Work Domain,Status,Onboarding Status,Review Status,Date of Exit",
      );
      expect(csv).toContain("'=HYPERLINK(evil)");
      expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);

      const lead = text(
        await binary(get("lead1", "/hr/employees/export")).expect(200),
      );
      expect(lead).not.toContain("Mechanical");
      expect(lead).toContain("Software");

      const filtered = text(
        await binary(get("hr", `/hr/employees/export?teamId=${team2}`)).expect(
          200,
        ),
      );
      expect(filtered).not.toMatch(/,Software,/);
    });
  });

  // ---------------------------------------------------------------------------
  describe("CSV import", () => {
    const header =
      "Full Name,Work Email,Phone,Team,Designation,Employment Type,Date of Joining,Work Location,Probation End Date";
    const line = (name: string, email: string, team = "Software") =>
      `${name},${email},,${team},Engineer,Permanent,2026-11-01,OMR Office,2027-05-01`;

    it("dry run validates every row and saves nothing", async () => {
      const before = await prisma.employee.count({
        where: { organizationId: org.id },
      });
      const res = await upload(
        "hr",
        [
          header,
          line("Dry One", "dry1@t.com"),
          line("Dry Two", "dry2@t.com"),
        ].join("\n"),
        "?dryRun=true",
      ).expect(201);
      expect(data(res)).toMatchObject({
        dryRun: true,
        totalRows: 2,
        validRows: 2,
        created: [],
        errors: [],
      });
      expect(
        await prisma.employee.count({ where: { organizationId: org.id } }),
      ).toBe(before);
    });

    it("creates every row in one go, with generated codes and audit rows", async () => {
      const res = await upload(
        "hr",
        [
          header,
          line("Imp One", "imp1@t.com"),
          line("Imp Two", "imp2@t.com", "mechanical"),
        ].join("\n"),
      ).expect(201);
      const report = data<{
        created: Array<{ row: number; id: number; employeeCode: string }>;
        errors: unknown[];
      }>(res);
      expect(report.errors).toEqual([]);
      expect(report.created.map((c) => c.row)).toEqual([2, 3]);
      const rows = await prisma.employee.findMany({
        where: { id: { in: report.created.map((c) => c.id) } },
        orderBy: { id: "asc" },
      });
      expect(rows.map((r) => [r.fullName, r.teamId])).toEqual([
        ["Imp One", team1],
        ["Imp Two", team2],
      ]);
      expect(rows[0]?.probationEndDate?.toISOString().slice(0, 10)).toBe(
        "2027-05-01",
      );
      expect(
        await prisma.auditLog.count({
          where: {
            entityType: "employee",
            action: "create",
            entityId: { in: report.created.map((c) => BigInt(c.id)) },
          },
        }),
      ).toBe(2);
    });

    it("any invalid row means nothing is created, and every problem is reported by row", async () => {
      const before = await prisma.employee.count({
        where: { organizationId: org.id },
      });
      const res = await upload(
        "hr",
        [
          header,
          line("Good Row", "good@t.com"),
          line("Bad Team", "badteam@t.com", "Electrical"),
          line("Dup Email", "imp1@t.com"),
        ].join("\n"),
      ).expect(201);
      const report = data<{
        validRows: number;
        created: unknown[];
        errors: Array<{ row: number; field?: string }>;
      }>(res);
      expect(report.created).toEqual([]);
      expect(report.validRows).toBe(1);
      expect(report.errors.map((e) => [e.row, e.field])).toEqual([
        [3, "team"],
        [4, "workEmail"],
      ]);
      expect(
        await prisma.employee.count({ where: { organizationId: org.id } }),
      ).toBe(before);
    });

    it("a team writer may import only into their own team", async () => {
      const res = await upload(
        "lead1",
        [
          header,
          line("Lead Own", "leadown@t.com"),
          line("Lead Other", "leadother@t.com", "Mechanical"),
        ].join("\n"),
      ).expect(201);
      const report = data<{
        created: unknown[];
        errors: Array<{ row: number }>;
      }>(res);
      expect(report.created).toEqual([]);
      expect(report.errors).toEqual([
        expect.objectContaining({ row: 3, field: "team" }),
      ]);
    });

    it("403 without a write permission; 400 for a bad header or no file", async () => {
      await upload("reader", [header, line("X", "x@t.com")].join("\n")).expect(
        403,
      );
      await upload("hr", "Nickname\nBob").expect(400);
      await post("hr", "/hr/employees/import").expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  describe("onboarding review", () => {
    let subject: Employee;
    let otherTeamSubject: Employee;

    const submit = (who: string) =>
      http().post("/employee/profile/submit").set(auth(who)).expect(201);
    const reviewOf = async (id: number) =>
      prisma.employee.findUniqueOrThrow({ where: { id } });

    beforeAll(async () => {
      subject = await createEmployee("hr", { fullName: "Review Subject" });
      await seedCompleteProfile(subject.id, team1);
      await mkUser(
        org,
        "hire",
        [
          "employee_self_service.profile.read",
          "employee_self_service.profile.write",
          // Approving also needs to see the employee (hr.employee.read).
          "hr.employee.read.all",
          "hr.employee_onboarding.approve.all",
        ],
        { employeeId: subject.id },
      );
      otherTeamSubject = await createEmployee("hr", {
        fullName: "Other Team Subject",
        teamId: team2,
      });
      await seedCompleteProfile(otherTeamSubject.id, team2);
      await mkUser(
        org,
        "hire2",
        [
          "employee_self_service.profile.read",
          "employee_self_service.profile.write",
        ],
        { employeeId: otherTeamSubject.id },
      );
    });

    it("submitting a complete profile opens the portal and queues it for review", async () => {
      const res = await submit("hire");
      expect(data<{ missing: string[] }>(res).missing).toEqual([]);
      const row = await reviewOf(subject.id);
      expect(row.onboardingStatus).toBe("COMPLETE");
      expect(row.onboardingReviewStatus).toBe("PENDING_REVIEW");
      expect(row.onboardingSubmittedAt).not.toBeNull();

      const queue = data<Array<{ id: number }>>(
        await get(
          "hr",
          "/hr/employees?onboardingReviewStatus=PENDING_REVIEW&limit=100",
        ).expect(200),
      );
      expect(queue.map((e) => e.id)).toContain(subject.id);
    });

    it("permission and scope: no permission 403, other team 404, own record refused", async () => {
      await submit("hire2");
      await post(
        "reader",
        `/hr/employees/${subject.id}/onboarding/approve`,
      ).expect(403);
      await post(
        "lead1",
        `/hr/employees/${otherTeamSubject.id}/onboarding/approve`,
      ).expect(404);
      // The employee holds the approve permission but may not review themselves.
      const self = await post(
        "hire",
        `/hr/employees/${subject.id}/onboarding/approve`,
      ).expect(422);
      expect(errorOf(self)).toBe("SELF_REVIEW_FORBIDDEN");
      expect((await reviewOf(subject.id)).onboardingReviewStatus).toBe(
        "PENDING_REVIEW",
      );
    });

    it("sending back needs a note, reopens the wizard and shows the note to the employee", async () => {
      await post(
        "hr",
        `/hr/employees/${subject.id}/onboarding/send-back`,
        {},
      ).expect(400);
      const res = await post(
        "lead1",
        `/hr/employees/${subject.id}/onboarding/send-back`,
        { note: "Upload a clearer PAN copy" },
      ).expect(200);
      expect(data<Employee>(res)).toMatchObject({
        onboardingStatus: "PENDING_ACTIVATION",
        onboardingReviewStatus: "CHANGES_REQUESTED",
        onboardingReviewNote: "Upload a clearer PAN copy",
      });
      const mine = data<Employee>(
        await get("hire", "/employee/profile").expect(200),
      );
      expect(mine.onboardingReviewNote).toBe("Upload a clearer PAN copy");

      const audit = await prisma.auditLog.findFirstOrThrow({
        where: {
          entityType: "employee",
          entityId: BigInt(subject.id),
          action: "send_back_onboarding",
        },
      });
      expect(audit.actorUserId).toBe(userIds.lead1);
      expect(audit.reason).toBe("Upload a clearer PAN copy");
    });

    it("a profile not waiting for review cannot be decided on", async () => {
      const res = await post(
        "hr",
        `/hr/employees/${subject.id}/onboarding/approve`,
      ).expect(422);
      expect(errorOf(res)).toBe("ONBOARDING_NOT_PENDING_REVIEW");
    });

    it("resubmitting queues it again; an incomplete profile cannot be approved", async () => {
      await submit("hire");
      expect((await reviewOf(subject.id)).onboardingReviewStatus).toBe(
        "PENDING_REVIEW",
      );
      const pan = await prisma.employeeDocument.findFirstOrThrow({
        where: { employeeId: subject.id, documentType: "PAN" },
      });
      await prisma.employeeDocument.update({
        where: { id: pan.id },
        data: { deletedAt: new Date() },
      });
      const res = await post(
        "hr",
        `/hr/employees/${subject.id}/onboarding/approve`,
      ).expect(422);
      expect(errorOf(res)).toBe("ONBOARDING_INCOMPLETE");
      await prisma.employeeDocument.update({
        where: { id: pan.id },
        data: { deletedAt: null },
      });
    });

    it("approving records the reviewer and keeps the portal open", async () => {
      const res = await post(
        "hr",
        `/hr/employees/${subject.id}/onboarding/approve`,
        { note: "All verified" },
      ).expect(200);
      expect(data<Employee>(res)).toMatchObject({
        onboardingStatus: "COMPLETE",
        onboardingReviewStatus: "APPROVED",
      });
      const row = await reviewOf(subject.id);
      expect(row.onboardingReviewedBy).toBe(userIds.hr);
      expect(row.onboardingReviewedAt).not.toBeNull();
      const progress = data<{ onboardingReviewStatus: string }>(
        await get("hr", `/hr/employees/${subject.id}/onboarding`).expect(200),
      );
      expect(progress.onboardingReviewStatus).toBe("APPROVED");
    });

    it("the database refuses CHANGES_REQUESTED without a note", async () => {
      await expect(
        prisma.employee.update({
          where: { id: subject.id },
          data: {
            onboardingReviewStatus: "CHANGES_REQUESTED",
            onboardingReviewNote: null,
          },
        }),
      ).rejects.toThrow();
    });
  });
});
