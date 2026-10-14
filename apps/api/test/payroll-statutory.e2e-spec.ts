import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { PayslipPdfRenderer } from "../src/modules/hr/payroll/payslips/payslip-pdf.renderer.js";
import { Form16PdfRenderer } from "../src/modules/hr/payroll/tax/form16.service.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

/**
 * The payroll statutory engine end to end (Docs/PAYROLL_AND_COMPLIANCE.md):
 * component master and templates, approved attendance, overtime, PT, TDS
 * with declarations, frozen payslips, statutory files, reopen, loan limits
 * and prepayments, statutory bonus, gratuity, Form 16 — and who may do each.
 */

interface Body<T> {
  data: T;
}

const ADMIN_PERMS = [
  "hr.payroll.read.all",
  "hr.payroll.write.all",
  "hr.payroll.finalize.all",
  "hr.payroll.reopen.all",
  "hr.payroll.export.all",
  "hr.payroll_settings.read",
  "hr.payroll_settings.write",
  "hr.salary.read.all",
  "hr.salary.write.all",
  "hr.pf.read.all",
  "hr.pf.write.all",
  "hr.esi.read.all",
  "hr.esi.write.all",
  "hr.loan.read.all",
  "hr.loan.write.all",
  "hr.bonus.read.all",
  "hr.bonus.write.all",
  "hr.payslip.read.all",
  "hr.payment.read.all",
  "hr.payment.write.all",
  "hr.tax_declaration.read.all",
  "hr.tax_declaration.write.all",
];
const CHECKER_PERMS = [
  "hr.payroll.read.all",
  "hr.payroll.approve.all",
  "hr.loan.read.all",
  "hr.loan.approve.all",
  "hr.tax_declaration.read.all",
  "hr.tax_declaration.approve.all",
];
/** Team-level grants: never org-wide operations, never other teams. */
const TEAM_LEAD_PERMS = [
  "hr.payroll.read.team",
  "hr.payroll.export.team",
  "hr.payroll.reopen.team",
  "hr.salary.read.team",
  "hr.salary.write.team",
  "hr.loan.read.team",
  "hr.loan.approve.team",
];
/** The HR review step of a loan, before the final approval. */
const REVIEWER_PERMS = ["hr.loan.read.all", "hr.loan.review.all"];
const EMPLOYEE_PERMS = [
  "employee_self_service.payslip.read",
  "employee_self_service.loan.read",
  "employee_self_service.loan.write",
  "employee_self_service.tax_declaration.read",
  "employee_self_service.tax_declaration.write",
  "employee_self_service.form16.read",
  // An .own write grant must still never write pay.
  "hr.salary.write.own",
];
const READER_PERMS = ["hr.payroll.read.all", "hr.payroll_settings.read"];

const PERMS = [
  ...new Set([
    ...ADMIN_PERMS,
    ...CHECKER_PERMS,
    ...TEAM_LEAD_PERMS,
    ...EMPLOYEE_PERMS,
    ...READER_PERMS,
    ...REVIEWER_PERMS,
  ]),
];

describe("Payroll statutory engine (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let org: { id: number; slug: string };
  const tokens: Record<string, string> = {};
  const users: Record<string, number> = {};
  const perm = new Map<string, number>();
  const suffix = randomUUID()
    .slice(0, 8)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "X");

  let employeeId: number;
  let otherTeamEmployeeId: number;
  let periodId: number;
  let payslipId: number;

  let pdfCounter = 0;
  const fakeRenderer = {
    render: () => Promise.resolve(Buffer.from(`%PDF stub ${++pdfCounter}`)),
  };

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });
  const get = (who: string, path: string) =>
    request(app.getHttpServer()).get(path).set(auth(who));
  const post = (who: string, path: string, body: object = {}) =>
    request(app.getHttpServer()).post(path).set(auth(who)).send(body);
  const put = (who: string, path: string, body: object = {}) =>
    request(app.getHttpServer()).put(path).set(auth(who)).send(body);
  const patch = (who: string, path: string, body: object = {}) =>
    request(app.getHttpServer()).patch(path).set(auth(who)).send(body);
  const dataOf = <T = Record<string, unknown>>(res: { body: unknown }): T =>
    (res.body as Body<T>).data;
  const errorOf = (res: { body: unknown }) =>
    (res.body as { error?: string }).error;
  const noticeTypes = async (who: string) =>
    dataOf<Array<{ type: string }>>(
      await get(who, "/notifications").expect(200),
    ).map((n) => n.type);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PayslipPdfRenderer)
      .useValue(fakeRenderer)
      .overrideProvider(Form16PdfRenderer)
      .useValue(fakeRenderer)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    org = await prisma.organization.create({
      data: { name: `Statutory Org ${suffix}`, slug: `statutory-${suffix}` },
    });
    for (const code of PERMS) {
      const p = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, description: code },
      });
      perm.set(code, p.id);
    }
    const passwordHash = await bcrypt.hash("Password123!", 10);
    async function mkUser(key: string, codes: string[]) {
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
      const res = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          organizationSlug: org.slug,
          email: `${key}-${suffix}@example.com`,
          password: "Password123!",
        })
        .expect(201);
      tokens[key] = (
        res.body as { data: { accessToken: string } }
      ).data.accessToken;
      users[key] = user.id;
      return user;
    }
    await mkUser("admin", ADMIN_PERMS);
    await mkUser("checker", CHECKER_PERMS);
    const lead = await mkUser("lead", TEAM_LEAD_PERMS);
    const empUser = await mkUser("emp", EMPLOYEE_PERMS);
    await mkUser("reader", READER_PERMS);
    await mkUser("reviewer", REVIEWER_PERMS);

    const dept = await prisma.department.create({
      data: { organizationId: org.id, name: `Dept ${suffix}` },
    });
    const teamA = await prisma.team.create({
      data: {
        organizationId: org.id,
        departmentId: dept.id,
        name: `A ${suffix}`,
        code: `SA_${suffix}`,
      },
    });
    const teamB = await prisma.team.create({
      data: {
        organizationId: org.id,
        departmentId: dept.id,
        name: `B ${suffix}`,
        code: `SB_${suffix}`,
      },
    });
    await prisma.userTeamAccess.create({
      data: { organizationId: org.id, userId: lead.id, teamId: teamA.id },
    });
    const desig = await prisma.designation.create({
      data: {
        organizationId: org.id,
        name: `Eng ${suffix}`,
        code: `SE_${suffix}`,
      },
    });
    const empType = await prisma.employmentType.create({
      data: {
        organizationId: org.id,
        name: `FT ${suffix}`,
        code: `SF_${suffix}`,
      },
    });
    const n = Math.floor(100000 + Math.random() * 800000);
    const mkEmp = (code: number, teamId: number, userId: number | null) =>
      prisma.employee.create({
        data: {
          organizationId: org.id,
          employeeCode: `EMP-${code}`,
          fullName: `Statutory ${code}`,
          departmentId: dept.id,
          teamId,
          designationId: desig.id,
          employmentTypeId: empType.id,
          userId,
          dateOfJoining: new Date("2025-01-01T00:00:00.000Z"),
          status: "ACTIVE",
        },
      });
    employeeId = (await mkEmp(n, teamA.id, empUser.id)).id;
    otherTeamEmployeeId = (await mkEmp(n + 1, teamB.id, null)).id;

    await prisma.employeePfProfile.create({
      data: {
        organizationId: org.id,
        employeeId,
        pfApplicable: true,
        uan: "100200300400",
        effectiveFrom: new Date("2025-01-01T00:00:00.000Z"),
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("1. settings: policy and employer details are saved; masters need payroll_settings.write", async () => {
    await patch("reader", "/hr/payroll/settings", { version: 0 }).expect(403);
    const res = await patch("admin", "/hr/payroll/settings", {
      version: 0,
      overtimeEnabled: true,
      overtimeRatePerHour: 100,
      ptEnabled: true,
      ptDefaultStateCode: "KA",
      tdsEnabled: true,
      defaultTaxRegime: "NEW",
      companyName: "TexaWave Test Pvt Ltd",
      companyTan: "BLRT12345A",
    }).expect(200);
    expect(
      dataOf<{ useAttendance: boolean; payDaysMode: string }>(res),
    ).toMatchObject({
      useAttendance: true,
      payDaysMode: "CALENDAR",
    });
    await patch("admin", "/hr/payroll/settings", {
      version: 1,
      payDaysMode: "FIXED_31",
    }).expect(400);
  });

  let templateId: number;

  it("2. component master and a template; reserved codes refused", async () => {
    await post("reader", "/hr/payroll/salary-components", {
      code: "SHIFT_ALLOWANCE",
      name: "Shift Allowance",
      kind: "EARNING",
    }).expect(403);
    const reserved = await post("admin", "/hr/payroll/salary-components", {
      code: "TDS",
      name: "Fake",
      kind: "DEDUCTION",
    }).expect(422);
    expect(errorOf(reserved)).toBe("COMPONENT_CODE_RESERVED");

    const list = dataOf<Array<{ id: number; code: string }>>(
      await get("reader", "/hr/payroll/salary-components").expect(200),
    );
    const id = (code: string) => list.find((c) => c.code === code)!.id;
    expect(list.map((c) => c.code)).toEqual(
      expect.arrayContaining(["BASIC", "DA", "HRA", "CONVEYANCE"]),
    );

    const tpl = await post("admin", "/hr/payroll/salary-templates", {
      code: `GRADE-${suffix}`,
      name: "Grade A",
      lines: [
        {
          componentId: id("BASIC"),
          calculationType: "PERCENT_OF_GROSS",
          value: 40,
        },
        {
          componentId: id("DA"),
          calculationType: "PERCENT_OF_GROSS",
          value: 10,
        },
        {
          componentId: id("HRA"),
          calculationType: "PERCENT_OF_BASIC",
          value: 50,
        },
        { componentId: id("SPECIAL_ALLOWANCE"), calculationType: "REMAINDER" },
      ],
    }).expect(201);
    templateId = dataOf<{ id: number }>(tpl).id;

    const preview = dataOf<{
      lines: Array<{ code: string; monthlyAmount: number }>;
    }>(
      await post(
        "reader",
        `/hr/payroll/salary-templates/${templateId}/preview`,
        {
          grossMonthly: 30000,
        },
      ).expect(200),
    );
    expect(preview.lines.map((l) => [l.code, l.monthlyAmount])).toEqual([
      ["BASIC", 12000],
      ["DA", 3000],
      ["HRA", 6000],
      ["SPECIAL_ALLOWANCE", 9000],
    ]);
  });

  it("3. salary from a template; team and own write grants stay inside their scope", async () => {
    // .team writer: another team's employee is "not found"
    await post("lead", "/hr/salaries", {
      employeeId: otherTeamEmployeeId,
      effectiveFrom: "2025-01-01",
      grossMonthly: 20000,
    }).expect(404);
    // .own writer: nobody sets their own pay
    await post("emp", "/hr/salaries", {
      employeeId,
      effectiveFrom: "2025-01-01",
      grossMonthly: 20000,
    }).expect(404);

    const res = await post("admin", "/hr/salaries", {
      employeeId,
      effectiveFrom: "2025-01-01",
      salaryTemplateId: templateId,
      grossMonthly: 30000,
    }).expect(201);
    const salary = dataOf<{
      grossMonthly: string;
      basic: string;
      components: Array<{ component: { code: string }; monthlyAmount: string }>;
    }>(res);
    expect(Number(salary.grossMonthly)).toBe(30000);
    expect(Number(salary.basic)).toBe(12000);
    expect(salary.components.map((c) => c.component.code)).toEqual([
      "BASIC",
      "DA",
      "HRA",
      "SPECIAL_ALLOWANCE",
    ]);
  });

  it("4. PT slabs, a tax regime and a verified declaration", async () => {
    await post("admin", "/hr/payroll/pt-slabs", {
      stateCode: "KA",
      minMonthlyWage: 0,
      maxMonthlyWage: 24999,
      monthlyAmount: 0,
      effectiveFrom: "2026-04-01",
    }).expect(201);
    await post("admin", "/hr/payroll/pt-slabs", {
      stateCode: "KA",
      minMonthlyWage: 25000,
      monthlyAmount: 200,
      effectiveFrom: "2026-04-01",
    }).expect(201);
    const overlap = await post("admin", "/hr/payroll/pt-slabs", {
      stateCode: "KA",
      minMonthlyWage: 20000,
      monthlyAmount: 150,
      effectiveFrom: "2026-04-01",
    }).expect(409);
    expect(errorOf(overlap)).toBe("PT_SLAB_OVERLAP");

    const gap = await put("admin", "/hr/payroll/tax-regimes", {
      financialYear: "2026-27",
      regime: "NEW",
      version: 0,
      standardDeduction: 75000,
      rebateIncomeLimit: 0,
      rebateMaxAmount: 0,
      cessPercent: 4,
      slabs: [
        { fromIncome: 0, toIncome: 100000, ratePercent: 0 },
        { fromIncome: 200000, toIncome: null, ratePercent: 10 },
      ],
    }).expect(422);
    expect(errorOf(gap)).toBe("TAX_SLABS_INVALID");
    await put("admin", "/hr/payroll/tax-regimes", {
      financialYear: "2026-27",
      regime: "NEW",
      version: 0,
      standardDeduction: 75000,
      rebateIncomeLimit: 0,
      rebateMaxAmount: 0,
      cessPercent: 4,
      slabs: [
        { fromIncome: 0, toIncome: 100000, ratePercent: 0 },
        { fromIncome: 100000, toIncome: null, ratePercent: 10 },
      ],
    }).expect(200);

    const saved = dataOf<{ id: number; status: string }>(
      await put("emp", "/self-service/tax-declarations/2026-27", {
        version: 0,
        regime: "NEW",
        otherIncome: 0,
        submit: true,
      }).expect(200),
    );
    expect(saved.status).toBe("SUBMITTED");
    // Locked once submitted
    await put("emp", "/self-service/tax-declarations/2026-27", {
      version: 1,
      regime: "OLD",
    }).expect(409);
    // The employee cannot verify; a checker can
    await post("emp", `/hr/tax-declarations/${saved.id}/verify`, {
      decision: "VERIFIED",
    }).expect(403);
    const verified = dataOf<{ status: string }>(
      await post("checker", `/hr/tax-declarations/${saved.id}/verify`, {
        decision: "VERIFIED",
      }).expect(200),
    );
    expect(verified.status).toBe("VERIFIED");
  });

  it("5. a run needs the approved attendance month; then absences, overtime, PF, PT and TDS apply", async () => {
    periodId = dataOf<{ id: number }>(
      await post("admin", "/hr/payroll/periods", {
        year: 2026,
        month: 4,
      }).expect(201),
    ).id;

    const refused = await post("admin", "/hr/payroll/runs", {
      payrollPeriodId: periodId,
      employeeIds: [employeeId],
    }).expect(422);
    expect(errorOf(refused)).toBe("ATTENDANCE_NOT_APPROVED");

    for (const id of [employeeId, otherTeamEmployeeId]) {
      await prisma.attendanceMonthLock.create({
        data: {
          organizationId: org.id,
          employeeId: id,
          month: new Date("2026-04-01T00:00:00.000Z"),
          status: "APPROVED",
          summary: {
            countsByStatus: {
              PRESENT: 20,
              ABSENT: 1,
              HALF_DAY: 0,
              HOLIDAY: 0,
              WEEKLY_OFF: 8,
              ON_LEAVE: 0,
              NOT_MARKED: 1,
            },
            overtimeMinutes: 120,
          },
          submittedBy: users.admin!,
          submittedAt: new Date(),
          decidedBy: users.checker!,
          decidedAt: new Date(),
        },
      });
    }
    // The other team's employee has no salary: run only for ours.
    const run = dataOf<{ id: number }>(
      await post("admin", "/hr/payroll/runs", {
        payrollPeriodId: periodId,
        employeeIds: [employeeId],
      }).expect(201),
    );
    const [entry] = dataOf<
      Array<{
        lopDays: string;
        absentDays: string;
        attendanceLockId: number | null;
        earnings: Array<{ code: string; calculatedAmount: string }>;
        deductions: Array<{ code: string; amount: string }>;
      }>
    >(
      await get("admin", `/hr/payroll/entries?payrollRunId=${run.id}`).expect(
        200,
      ),
    );
    expect(Number(entry!.absentDays)).toBe(2);
    expect(Number(entry!.lopDays)).toBe(2);
    expect(entry!.attendanceLockId).not.toBeNull();
    expect(
      Number(
        entry!.earnings.find((e) => e.code === "OVERTIME")?.calculatedAmount,
      ),
    ).toBe(200);
    const ded = (code: string) =>
      Number(entry!.deductions.find((d) => d.code === code)?.amount ?? 0);
    // Basic + DA earned: 15000 × (1 − 2/30, ratio 0.9333) = 13999.5, under
    // the 15000 ceiling → 12% = 1679.94.
    expect(ded("PF")).toBe(1679.94);
    expect(ded("PT")).toBe(200);
    expect(ded("TDS")).toBeGreaterThan(0);

    const pf = await prisma.pfContribution.findFirstOrThrow({
      where: { payrollPeriodId: periodId, employeeId },
    });
    // EPS 8.33% of 13999.5 = 1166.16; the employer EPF share is the rest.
    expect(Number(pf.epsContribution)).toBe(1166.16);
    expect(Number(pf.epfEmployerContribution)).toBe(513.78);

    await post("checker", `/hr/payroll/runs/${run.id}/approve`, {}).expect(200);
    await post("admin", `/hr/payroll/periods/${periodId}/finalize`).expect(200);
  });

  it("6. a payslip is frozen: the PDF bytes never change, and the employee sees their own", async () => {
    const [slip] = dataOf<Array<{ id: number; version: number }>>(
      await get("emp", "/self-service/payslips").expect(200),
    );
    payslipId = slip!.id;
    expect(slip!.version).toBe(1);
    // No PDF bytes in JSON.
    expect(slip).not.toHaveProperty("pdfContent");

    const first = await get(
      "emp",
      `/self-service/payslips/${payslipId}/pdf`,
    ).expect(200);
    // The company name changes after issue — the payslip does not.
    await patch("admin", "/hr/payroll/settings", {
      version: 1,
      companyName: "Renamed Pvt Ltd",
    }).expect(200);
    const second = await get("admin", `/hr/payslips/${payslipId}/pdf`).expect(
      200,
    );
    expect(Buffer.from(second.body as Buffer).toString()).toBe(
      Buffer.from(first.body as Buffer).toString(),
    );
  });

  it("7. statutory files and reports: org-wide export only", async () => {
    const base = `/hr/payroll/periods/${periodId}/reports`;
    await get("lead", `${base}/pf-ecr`).expect(403);
    await get("reader", `${base}/pf-ecr`).expect(403);

    const ecr = await get("admin", `${base}/pf-ecr`).expect(200);
    const line = ecr.text.trim();
    expect(line.startsWith("100200300400#~#")).toBe(true);
    expect(line.split("#~#")).toHaveLength(11);

    const journal = (await get("admin", `${base}/journal`).expect(200)).text;
    const rows = journal
      .slice(journal.charCodeAt(0) === 0xfeff ? 1 : 0)
      .split("\r\n")
      .slice(1)
      .map((r) => r.split(",").map((c) => c.replace(/"/g, "")));
    const debit = rows.reduce((s, r) => s + Number(r[1]), 0);
    const credit = rows.reduce((s, r) => s + Number(r[2]), 0);
    expect(Math.round(debit * 100)).toBe(Math.round(credit * 100));

    for (const report of [
      "esi",
      "professional-tax",
      "tds",
      "salary-register",
    ]) {
      await get("admin", `${base}/${report}`).expect(200);
    }
  });

  it("8. reopen: org-wide with a reason; re-approval needed; a changed payslip becomes version 2", async () => {
    await post("lead", `/hr/payroll/periods/${periodId}/reopen`, {
      reason: "Overtime was entered wrongly",
    }).expect(403);
    await post("admin", `/hr/payroll/periods/${periodId}/reopen`, {
      reason: "short",
    }).expect(400);
    const reopened = dataOf<{ status: string; reopenCount: number }>(
      await post("admin", `/hr/payroll/periods/${periodId}/reopen`, {
        reason: "Overtime was entered wrongly",
      }).expect(200),
    );
    expect(reopened).toMatchObject({ status: "REOPENED", reopenCount: 1 });

    // The run is back to PROCESSED: finalize needs a fresh approval first.
    await post("admin", `/hr/payroll/periods/${periodId}/finalize`).expect(422);
    const run = await prisma.payrollRun.findFirstOrThrow({
      where: { payrollPeriodId: periodId, status: "PROCESSED" },
    });
    await post("checker", `/hr/payroll/runs/${run.id}/approve`, {}).expect(200);
    await post("admin", `/hr/payroll/periods/${periodId}/finalize`).expect(200);

    // The employer name changed since issue, so the payslip was regenerated
    // as version 2 with the reopen reason.
    const slip = await prisma.payslip.findUniqueOrThrow({
      where: { id: payslipId },
    });
    expect(slip.version).toBe(2);
    expect(slip.regenerationReason).toBe(
      "Period reopened: Overtime was entered wrongly",
    );
    expect(slip.pdfContent).toBeNull();

    const actions = (
      await prisma.auditLog.findMany({
        where: {
          organizationId: org.id,
          entityType: { in: ["payroll_run", "payroll_period"] },
        },
        select: { action: true },
      })
    ).map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining(["create", "approve", "finalize", "reopen"]),
    );
  });

  it("9. a paid month cannot be reopened", async () => {
    const batch = dataOf<{ id: number }>(
      await post("admin", "/hr/payment-batches", {
        payrollPeriodId: periodId,
        paymentMethod: "CASH",
      }).expect(201),
    );
    await post("admin", `/hr/payment-batches/${batch.id}/process`).expect(200);
    const res = await post("admin", `/hr/payroll/periods/${periodId}/reopen`, {
      reason: "Trying after salary was paid",
    }).expect(422);
    expect(errorOf(res)).toBe("PAYROLL_ALREADY_PAID");
  });

  it("10. loan limits, maker-checker approval and prepayment", async () => {
    const over = await post("admin", "/hr/loans", {
      employeeId,
      principalAmount: 100000,
      emiAmount: 10000,
      emiMonths: 10,
      disbursedDate: "2026-09-01",
    }).expect(422);
    expect(errorOf(over)).toBe("LOAN_OVER_LIMIT");

    const loan = dataOf<{ id: number; limitOverride: boolean; status: string }>(
      await post("admin", "/hr/loans", {
        employeeId,
        principalAmount: 100000,
        emiAmount: 10000,
        emiMonths: 10,
        disbursedDate: "2026-09-01",
        overrideReason: "Medical emergency, approved by director",
      }).expect(201),
    );
    expect(loan).toMatchObject({
      limitOverride: true,
      status: "PENDING_HR",
    });

    // The final approval only comes after the HR review.
    const early = await post("checker", `/hr/loans/${loan.id}/decide`, {
      decision: "APPROVED",
    }).expect(422);
    expect(errorOf(early)).toBe("INVALID_STATE_TRANSITION");
    expect(
      dataOf<{ status: string }>(
        await post("reviewer", `/hr/loans/${loan.id}/review`, {
          decision: "FORWARD",
        }).expect(200),
      ).status,
    ).toBe("PENDING_ADMIN");

    // A team-level approver may not decide an over-limit loan.
    await post("lead", `/hr/loans/${loan.id}/decide`, {
      decision: "APPROVED",
    }).expect(403);
    await post("checker", `/hr/loans/${loan.id}/decide`, {
      decision: "APPROVED",
    }).expect(200);

    const prepayment = dataOf<{ id: number }>(
      await post("admin", `/hr/loans/${loan.id}/prepayments`, {
        amount: 15000,
        receivedOn: "2026-09-15",
        reason: "Paid from bonus",
      }).expect(201),
    );
    await post("admin", `/hr/loans/prepayments/${prepayment.id}/decide`, {
      decision: "APPROVED",
    }).expect(403);
    const after = dataOf<{
      repayments: Array<{
        installmentNo: number;
        status: string;
        amount: string;
      }>;
    }>(
      await post("checker", `/hr/loans/prepayments/${prepayment.id}/decide`, {
        decision: "APPROVED",
      }).expect(200),
    );
    const byNo = (n: number) =>
      after.repayments.find((r) => r.installmentNo === n)!;
    expect(byNo(10).status).toBe("PREPAID");
    expect(Number(byNo(9).amount)).toBe(5000);
    expect(byNo(9).status).toBe("PENDING");

    // The employee sees their own loan.
    const mine = dataOf<Array<{ id: number }>>(
      await get("emp", "/self-service/loans").expect(200),
    );
    expect(mine.map((l) => l.id)).toContain(loan.id);
    expect(await noticeTypes("emp")).toContain("loan.approved");
  });

  it("10b. an employee requests a loan: HR reviews, someone else decides, each step notifies", async () => {
    const body = {
      principalAmount: 5000,
      emiAmount: 1000,
      emiMonths: 5,
      disbursedDate: "2026-09-01",
      reason: "School fees",
    };
    // The self-service route needs the self-service grant.
    await post("admin", "/self-service/loans", body).expect(403);
    // The employee is always the caller; a client employeeId is not accepted.
    await post("emp", "/self-service/loans", {
      ...body,
      employeeId: otherTeamEmployeeId,
    }).expect(400);
    const request1 = dataOf<{
      id: number;
      status: string;
      requestedVia: string;
      employeeId: number;
    }>(await post("emp", "/self-service/loans", body).expect(201));
    expect(request1).toMatchObject({
      status: "PENDING_HR",
      requestedVia: "SELF",
      employeeId,
    });
    expect(await noticeTypes("reviewer")).toContain("loan.requested");

    // The borrower has no HR grant to review or decide their own loan.
    await post("emp", `/hr/loans/${request1.id}/review`, {
      decision: "FORWARD",
    }).expect(403);
    const noNote = await post("reviewer", `/hr/loans/${request1.id}/review`, {
      decision: "REJECT",
    }).expect(422);
    expect(errorOf(noNote)).toBe("DECISION_NOTE_REQUIRED");
    await post("reviewer", `/hr/loans/${request1.id}/review`, {
      decision: "FORWARD",
    }).expect(200);
    // Reviewed exactly once.
    await post("reviewer", `/hr/loans/${request1.id}/review`, {
      decision: "FORWARD",
    }).expect(422);
    // Every final approver in scope is told: org-wide and the team's lead.
    expect(await noticeTypes("checker")).toContain("loan.forwarded");
    expect(await noticeTypes("lead")).toContain("loan.forwarded");

    const rejected = dataOf<{ status: string; hrReviewedById: number }>(
      await post("checker", `/hr/loans/${request1.id}/decide`, {
        decision: "REJECTED",
        note: "Budget closed this quarter",
      }).expect(200),
    );
    expect(rejected).toMatchObject({
      status: "REJECTED",
      hrReviewedById: users.reviewer,
    });
    expect(await noticeTypes("emp")).toContain("loan.rejected");

    // HR may also reject at the review step; the employee is told why.
    const request2 = dataOf<{ id: number }>(
      await post("emp", "/self-service/loans", body).expect(201),
    );
    const hrRejected = dataOf<{ status: string; decisionNote: string }>(
      await post("reviewer", `/hr/loans/${request2.id}/review`, {
        decision: "REJECT",
        note: "Probation not completed",
      }).expect(200),
    );
    expect(hrRejected).toMatchObject({
      status: "REJECTED",
      decisionNote: "Probation not completed",
    });
    await post("checker", `/hr/loans/${request2.id}/decide`, {
      decision: "APPROVED",
    }).expect(422);
  });

  it("11. statutory bonus preview, gratuity and Form 16", async () => {
    await post("lead", "/hr/bonuses/statutory", {
      financialYear: "2026-27",
    }).expect(403);
    const bonus = dataOf<{
      employees: Array<{ employee: { id: number }; workedDays: number }>;
    }>(
      await post("admin", "/hr/bonuses/statutory", {
        financialYear: "2026-27",
      }).expect(200),
    );
    expect(bonus.employees.map((e) => e.employee.id)).toEqual([employeeId]);

    const gratuity = dataOf<{ eligible: boolean; completedYears: number }>(
      await get(
        "admin",
        `/hr/bonuses/gratuity/${employeeId}?asOf=2026-10-01`,
      ).expect(200),
    );
    expect(gratuity).toMatchObject({ eligible: false, completedYears: 1 });

    const form16 = dataOf<{
      months: unknown[];
      totals: { tdsDeducted: number };
      employer: { tan: string };
    }>(await get("emp", "/self-service/form16/2026-27").expect(200));
    expect(form16.months).toHaveLength(1);
    expect(form16.totals.tdsDeducted).toBeGreaterThan(0);
    expect(form16.employer.tan).toBe("BLRT12345A");
    await get("emp", "/self-service/form16/2026-27/pdf").expect(200);
    await get(
      "admin",
      `/hr/tax-declarations/form16/${employeeId}/2026-27`,
    ).expect(200);
    // The team lead has no tax-declaration grant.
    await get(
      "lead",
      `/hr/tax-declarations/form16/${employeeId}/2026-27`,
    ).expect(403);
  });
});
