import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import * as bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import request from "supertest";
import { AppModule } from "../src/app.module.js";
import { FieldEncryptionService } from "../src/shared/crypto/field-encryption.service.js";
import { PrismaService } from "../src/shared/prisma/prisma.service.js";

interface Body<T> {
  data: T;
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

const ADMIN_PERMS = [
  "hr.employee.read.all",
  "hr.employee.write.all",
  "hr.payroll.read.own",
  "hr.payroll.read.team",
  "hr.payroll.read.all",
  "hr.payroll.write.all",
  "hr.payroll.approve.all",
  "hr.payroll.finalize.all",
  "hr.salary.read.all",
  "hr.salary.write.all",
  "hr.pf.read.all",
  "hr.pf.write.all",
  "hr.esi.read.all",
  "hr.esi.write.all",
  "hr.loan.read.all",
  "hr.loan.write.all",
  "hr.loan.approve.all",
  "hr.bonus.read.all",
  "hr.bonus.write.all",
  "hr.bonus.approve.all",
  "hr.payslip.read.all",
  "hr.payment.read.all",
  "hr.payment.write.all",
  "employee_self_service.payslip.read",
  "employee_self_service.loan.read",
];

/** The "checker" of maker-checker: approves what the admin (maker) raised. */
const CHECKER_PERMS = [
  "hr.payroll.read.all",
  "hr.payroll.approve.all",
  "hr.bonus.read.all",
  "hr.bonus.approve.all",
  "hr.loan.read.all",
  "hr.loan.approve.all",
];

/** Team-level grants only — must never reach other teams or org-wide ops. */
const TEAM_LEAD_PERMS = [
  "hr.salary.read.team",
  "hr.salary.write.team",
  "hr.payroll.read.team",
  "hr.payroll.write.team",
  "hr.payment.read.team",
  "hr.payment.write.team",
];

const PERMS = [
  ...new Set([...ADMIN_PERMS, ...CHECKER_PERMS, ...TEAM_LEAD_PERMS]),
];

describe("Payroll & Compliance (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let org: { id: number; slug: string };
  let otherOrgPeriodId: number;
  const tokens: Record<string, string> = {};
  const perm = new Map<string, number>();
  const rawSuffix = randomUUID().slice(0, 8);
  const suffix = rawSuffix.toUpperCase().replace(/[^A-Z0-9]/g, "X");

  let departmentId: number;
  let teamId: number;
  let teamBId: number;
  let designationId: number;
  let employmentTypeId: number;
  let employeeId1: number;
  let employeeId2: number;
  let employeeId3: number;
  let salaryId1: number;
  let loanId1: number;

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

  interface EntryItem {
    employeeId: number;
    totalGrossEarnings: number | string;
    totalDeductions: number | string;
    netPayable: number | string;
    earnings: Array<{ code: string; calculatedAmount: number | string }>;
    deductions: Array<{ code: string; amount: number | string }>;
  }
  const entriesOf = async (runId: number) =>
    dataOf<EntryItem[]>(
      await get("admin", `/hr/payroll/entries?payrollRunId=${runId}`).expect(
        200,
      ),
    );
  const createPeriod = async (month: number) =>
    dataOf<{ id: number }>(
      await post("admin", "/hr/payroll/periods", { year: 2026, month }).expect(
        201,
      ),
    ).id;
  const createRun = async (periodId: number) =>
    dataOf<{ id: number; status: string }>(
      await post("admin", "/hr/payroll/runs", {
        payrollPeriodId: periodId,
      }).expect(201),
    );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    // Organization
    org = await prisma.organization.create({
      data: { name: `Payroll Org ${suffix}`, slug: `payroll-org-${suffix}` },
    });

    // A second organization with a payroll period of its own — used to prove
    // its ids are "not found" from this org.
    const otherOrg = await prisma.organization.create({
      data: {
        name: `Payroll Other Org ${suffix}`,
        slug: `payroll-other-${suffix}`,
      },
    });
    otherOrgPeriodId = (
      await prisma.payrollPeriod.create({
        data: {
          organizationId: otherOrg.id,
          year: 2026,
          month: 5,
          periodStart: new Date("2026-05-01T00:00:00.000Z"),
          periodEnd: new Date("2026-05-31T00:00:00.000Z"),
          status: "APPROVED",
        },
      })
    ).id;

    // Cache permissions
    const dbPerms = await prisma.permission.findMany({
      where: { code: { in: PERMS } },
    });
    for (const p of dbPerms) {
      perm.set(p.code, p.id);
    }

    const passwordHash = await bcrypt.hash("Password123!", 10);

    // Helper to create users
    async function mkUser(key: string, codes: string[]) {
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
      return user;
    }

    // Admin user with all permissions (the "maker")
    await mkUser("admin", ADMIN_PERMS);
    // Approver (the "checker")
    await mkUser("checker", CHECKER_PERMS);
    // Team lead with only team-level grants
    const teamLead = await mkUser("teamlead", TEAM_LEAD_PERMS);

    // Employee 1 user with self-service
    const empUser1 = await mkUser("emp1", [
      "employee_self_service.payslip.read",
      "employee_self_service.loan.read",
    ]);

    // Master data
    const dept = await prisma.department.create({
      data: { organizationId: org.id, name: `Eng ${suffix}` },
    });
    departmentId = dept.id;

    const team = await prisma.team.create({
      data: {
        organizationId: org.id,
        departmentId,
        name: `Team A ${suffix}`,
        code: `TMA_${suffix}`,
      },
    });
    teamId = team.id;

    const teamB = await prisma.team.create({
      data: {
        organizationId: org.id,
        departmentId,
        name: `Team B ${suffix}`,
        code: `TMB_${suffix}`,
      },
    });
    teamBId = teamB.id;

    await prisma.userTeamAccess.create({
      data: { organizationId: org.id, userId: teamLead.id, teamId },
    });

    const desig = await prisma.designation.create({
      data: {
        organizationId: org.id,
        name: `Dev ${suffix}`,
        code: `DEV_${suffix}`,
      },
    });
    designationId = desig.id;

    const empType = await prisma.employmentType.create({
      data: {
        organizationId: org.id,
        name: `FullTime ${suffix}`,
        code: `FT_${suffix}`,
      },
    });
    employmentTypeId = empType.id;

    const randNum = Math.floor(100000 + Math.random() * 800000);

    // Create Employee 1 linked to empUser1
    const emp1 = await prisma.employee.create({
      data: {
        organizationId: org.id,
        employeeCode: `EMP-${randNum}`,
        fullName: "Employee One",
        departmentId,
        teamId,
        designationId,
        employmentTypeId,
        userId: empUser1.id,
        dateOfJoining: new Date("2026-01-01T00:00:00.000Z"),
        status: "ACTIVE",
      },
    });
    employeeId1 = emp1.id;

    // Create Employee 2
    const emp2 = await prisma.employee.create({
      data: {
        organizationId: org.id,
        employeeCode: `EMP-${randNum + 1}`,
        fullName: "Employee Two",
        departmentId,
        teamId,
        designationId,
        employmentTypeId,
        dateOfJoining: new Date("2026-01-01T00:00:00.000Z"),
        status: "ACTIVE",
      },
    });
    employeeId2 = emp2.id;

    // Employee 3 in Team B — outside the team lead's teams. Joins in 2027, so
    // no 2026 payroll run picks them up.
    const emp3 = await prisma.employee.create({
      data: {
        organizationId: org.id,
        employeeCode: `EMP-${randNum + 2}`,
        fullName: "Employee Three",
        departmentId,
        teamId: teamBId,
        designationId,
        employmentTypeId,
        dateOfJoining: new Date("2027-01-01T00:00:00.000Z"),
        status: "ACTIVE",
      },
    });
    employeeId3 = emp3.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("1. sets up salary structures for employees", async () => {
    // Employee 1: gross 50,000 (basic 25000, hra 15000, conv 2000, other 3000, spec 5000)
    const res1 = await post("admin", "/hr/salaries", {
      employeeId: employeeId1,
      grossMonthly: 50000,
      basic: 25000,
      hra: 15000,
      conveyance: 2000,
      otherAllowance: 3000,
      specialAllowance: 5000,
      effectiveFrom: "2026-01-01",
    }).expect(201);

    const d1 = dataOf<{
      id: number;
      employeeId: number;
      grossMonthly: number | string;
    }>(res1);
    expect(d1.employeeId).toBe(employeeId1);
    expect(Number(d1.grossMonthly)).toBe(50000);
    salaryId1 = d1.id;

    // Employee 2: gross 20,000 (qualifies for ESI)
    const res2 = await post("admin", "/hr/salaries", {
      employeeId: employeeId2,
      grossMonthly: 20000,
      basic: 10000,
      hra: 5000,
      conveyance: 2000,
      otherAllowance: 3000,
      specialAllowance: 0,
      effectiveFrom: "2026-01-01",
    }).expect(201);

    const d2 = dataOf<{ employeeId: number; grossMonthly: number | string }>(
      res2,
    );
    expect(d2.employeeId).toBe(employeeId2);
    expect(Number(d2.grossMonthly)).toBe(20000);
  });

  it("2. sets up PF & ESI compliance profiles and bank details", async () => {
    // PF profile for Employee 1
    await put("admin", `/hr/compliance/pf/profiles/${employeeId1}`, {
      pfApplicable: true,
      uan: "100123456789",
      pfNumber: "MH/PUN/0012345/000/0001",
      effectiveFrom: "2026-01-01",
    }).expect(200);

    // ESI profile for Employee 2
    await put("admin", `/hr/compliance/esi/profiles/${employeeId2}`, {
      esiApplicable: true,
      insuranceNumber: "31001234560010001",
      effectiveFrom: "2026-01-01",
    }).expect(200);

    // Bank details and PAN come from the employee's onboarding record —
    // payroll has no write endpoint of its own for them.
    const encryption = app.get(FieldEncryptionService);
    const seedBank = (
      employeeId: number,
      accountNumber: string,
      ifsc: string,
      bankName: string,
    ) =>
      prisma.employeeBankDetail.create({
        data: {
          organizationId: org.id,
          teamId,
          employeeId,
          accountHolderName: "Test Holder",
          accountNumberEncrypted: encryption.encrypt(accountNumber),
          accountNumberMasked: encryption.mask(accountNumber),
          ifsc,
          bankName,
        },
      });
    await seedBank(employeeId1, "50100123456789", "HDFC0001234", "HDFC Bank");
    await seedBank(
      employeeId2,
      "20100123456789",
      "SBIN0001234",
      "State Bank of India",
    );
    await prisma.employeeGovernmentId.create({
      data: {
        organizationId: org.id,
        teamId,
        employeeId: employeeId1,
        panNumber: "ABCDE1234F",
      },
    });

    // The old payroll-owned bank-details endpoint is gone
    await put("admin", `/hr/bank-details/${employeeId1}`, {}).expect(404);
  });

  it("3. creates employee loan and bonus; bonus needs a second approver", async () => {
    // A schedule that does not add up to the principal is rejected
    await post("admin", "/hr/loans", {
      employeeId: employeeId1,
      principalAmount: 12000,
      emiAmount: 1000,
      emiMonths: 6,
      disbursedDate: "2026-01-01",
    }).expect(422);

    // Create loan for Employee 1: 12000 with 1000 EMI
    const loanRes = await post("admin", "/hr/loans", {
      employeeId: employeeId1,
      principalAmount: 12000,
      emiAmount: 1000,
      emiMonths: 12,
      disbursedDate: "2026-01-01",
      reason: "Personal emergency",
    }).expect(201);

    const loanData = dataOf<{
      id: number;
      loanNumber: string;
      repayments: unknown[];
    }>(loanRes);
    expect(loanData.loanNumber).toMatch(/^LOAN-/);
    expect(loanData.repayments).toHaveLength(12);
    loanId1 = loanData.id;

    // Create performance bonus for Employee 1: 5000
    const bonusRes = await post("admin", "/hr/bonuses", {
      employeeId: employeeId1,
      bonusType: "PERFORMANCE",
      amount: 5000,
      reason: "Q1 Outstanding Performance",
    }).expect(201);

    const bonusData = dataOf<{ id: number }>(bonusRes);

    // Maker-checker: the creator cannot approve it
    await post("admin", `/hr/bonuses/${bonusData.id}/decide`, {
      decision: "APPROVED",
    }).expect(403);

    await post("checker", `/hr/bonuses/${bonusData.id}/decide`, {
      decision: "APPROVED",
      note: "Approved by HR Head",
    }).expect(200);
  });

  let periodId: number;

  it("4. manages payroll period lifecycle & duplicate prevention", async () => {
    // Create May 2026 payroll period
    const res = await post("admin", "/hr/payroll/periods", {
      year: 2026,
      month: 5,
      periodStart: "2026-05-01",
      periodEnd: "2026-05-31",
    }).expect(201);

    const periodData = dataOf<{
      id: number;
      year: number;
      month: number;
      status: string;
    }>(res);
    periodId = periodData.id;
    expect(periodData.year).toBe(2026);
    expect(periodData.month).toBe(5);
    expect(periodData.status).toBe("DRAFT");

    // Duplicate creation for same year and month must be rejected (409)
    await post("admin", "/hr/payroll/periods", {
      year: 2026,
      month: 5,
    }).expect(409);
  });

  let runId: number;

  it("5. executes payroll run and verifies calculations", async () => {
    // Run payroll for May 2026
    const res = await post("admin", "/hr/payroll/runs", {
      payrollPeriodId: periodId,
      notes: "May 2026 Regular Run",
    }).expect(201);

    const runData = dataOf<{ id: number; status: string }>(res);
    runId = runData.id;
    expect(runData.status).toBe("PROCESSED");

    const entries = await entriesOf(runId);
    expect(entries).toHaveLength(2);

    // Verify Employee 1 entry:
    // Base gross: 50000, Bonus: 5000 -> Total gross: 55000
    // PF: 1800 (12% of the 15000 PF wage cap), Loan EMI: 1000 -> Deductions: 2800
    // Net payable: 55000 - 2800 = 52200
    const entry1 = entries.find((e) => e.employeeId === employeeId1);
    expect(entry1).toBeDefined();
    expect(Number(entry1?.totalGrossEarnings)).toBe(55000);
    expect(Number(entry1?.totalDeductions)).toBe(2800);
    expect(Number(entry1?.netPayable)).toBe(52200);

    // Verify Employee 2 entry:
    // Base gross: 20000
    // ESI: 0.75% of 20000 = 150
    // Net payable: 20000 - 150 = 19850
    const entry2 = entries.find((e) => e.employeeId === employeeId2);
    expect(entry2).toBeDefined();
    expect(Number(entry2?.totalGrossEarnings)).toBe(20000);
    expect(Number(entry2?.totalDeductions)).toBe(150);
    expect(Number(entry2?.netPayable)).toBe(19850);
  });

  it("6. approves run (maker-checker) and finalizes period with auto-generated payslips", async () => {
    // The creator of the run cannot approve it
    await post("admin", `/hr/payroll/runs/${runId}/approve`).expect(403);

    await post("checker", `/hr/payroll/runs/${runId}/approve`, {
      notes: "Approved after HR audit",
    }).expect(200);

    // Approving twice is rejected
    await post("checker", `/hr/payroll/runs/${runId}/approve`).expect(422);

    // No payout before the period is finalized
    await post("admin", "/hr/payment-batches", {
      payrollPeriodId: periodId,
    }).expect(422);

    // Finalize period
    const finalizeRes = await post(
      "admin",
      `/hr/payroll/periods/${periodId}/finalize`,
    ).expect(200);
    const finData = dataOf<{ status: string }>(finalizeRes);
    expect(finData.status).toBe("FINALIZED");

    // ...exactly once
    await post("admin", `/hr/payroll/periods/${periodId}/finalize`).expect(422);

    // Verify payslips were auto-generated
    const payslipsRes = await get(
      "admin",
      `/hr/payslips?payrollPeriodId=${periodId}`,
    ).expect(200);
    interface PayslipItem {
      employeeId: number;
      netPayable: number | string;
      payslipNumber: string;
      employee: {
        bankDetails: {
          accountNumber: string;
          panNumber?: string | null;
        } | null;
      };
    }
    const payslips = dataOf<PayslipItem[]>(payslipsRes);
    expect(payslips).toHaveLength(2);

    const ps1 = payslips.find((p) => p.employeeId === employeeId1);
    expect(ps1).toBeDefined();
    expect(Number(ps1?.netPayable)).toBe(52200);
    expect(ps1?.payslipNumber).toMatch(/^PS-202605-/);
    expect(ps1?.employee.bankDetails?.accountNumber).toBe("XXXXXXXXXX6789");
    expect(ps1?.employee.bankDetails?.panNumber).toBe("******234F");

    // The May installment of loan 1 is settled, the loan stays active
    const repayments = await prisma.loanRepayment.findMany({
      where: { loanId: loanId1 },
      orderBy: { installmentNo: "asc" },
    });
    expect(repayments[0]?.status).toBe("PAID");
    expect(repayments.filter((r) => r.status === "PENDING")).toHaveLength(11);
  });

  it("7. generates payment batch, exports bank CSV, and processes disbursal", async () => {
    // Generate batch
    const batchRes = await post("admin", "/hr/payment-batches", {
      payrollPeriodId: periodId,
      paymentMethod: "BANK_TRANSFER",
    }).expect(201);

    interface BatchItem {
      id: number;
      totalEmployees: number;
      totalAmount: number | string;
      status: string;
      payments: Array<{
        status: string;
        employee: { bankDetails: { accountNumber: string } | null };
      }>;
    }
    const bData = dataOf<BatchItem>(batchRes);
    const batchId = bData.id;
    expect(bData.totalEmployees).toBe(2);
    expect(Number(bData.totalAmount)).toBe(52200 + 19850);
    for (const p of bData.payments) {
      expect(p.employee.bankDetails?.accountNumber).toMatch(/^X+\d{4}$/);
    }

    // A second payout batch for the same period is refused
    await post("admin", "/hr/payment-batches", {
      payrollPeriodId: periodId,
    }).expect(409);

    // Export bank CSV
    const exportRes = await get(
      "admin",
      `/hr/payment-batches/${batchId}/export`,
    ).expect(200);
    const expData = dataOf<{ content: string }>(exportRes);
    expect(expData.content).toContain(
      "Employee Code,Employee Name,Bank Name,Account Number,IFSC Code",
    );
    expect(expData.content).toContain("HDFC0001234");
    // The bank needs the full account number; PAN is not part of the file
    expect(expData.content).toContain("50100123456789");
    expect(expData.content).not.toContain("ABCDE1234F");
    expect(expData.content).toContain("52200");

    // Process batch (mark paid)
    const procRes = await post(
      "admin",
      `/hr/payment-batches/${batchId}/process`,
    ).expect(200);
    const prData = dataOf<BatchItem>(procRes);
    expect(prData.status).toBe("PROCESSED");
    for (const payment of prData.payments) {
      expect(payment.status).toBe("PAID");
    }

    // ...exactly once
    await post("admin", `/hr/payment-batches/${batchId}/process`).expect(422);
  });

  it("8. supports employee self-service payslips and loans", async () => {
    interface SelfServicePayslip {
      employeeId: number;
      netPayable: number | string;
    }
    // Employee 1 checks their own payslips
    const psRes = await get("emp1", "/self-service/payslips").expect(200);
    const myPayslips = dataOf<SelfServicePayslip[]>(psRes);
    expect(myPayslips).toHaveLength(1);
    expect(myPayslips[0]?.employeeId).toBe(employeeId1);
    expect(Number(myPayslips[0]?.netPayable)).toBe(52200);

    // Employee 1 checks their own loans
    const loanRes = await get("emp1", "/self-service/loans").expect(200);
    const myLoans = dataOf<Array<{ employeeId: number }>>(loanRes);
    expect(myLoans).toHaveLength(1);
    expect(myLoans[0]?.employeeId).toBe(employeeId1);
  });

  it("9. keeps team-level grants inside their teams and out of org-wide operations", async () => {
    // Salary structures: same boundary
    await post("teamlead", "/hr/salaries", {
      employeeId: employeeId3,
      basic: 10000,
      hra: 5000,
      effectiveFrom: "2027-01-01",
    }).expect(404);

    // Org-wide payroll operations need an .all grant
    await post("teamlead", "/hr/payroll/periods", {
      year: 2026,
      month: 11,
    }).expect(403);
    await post("teamlead", "/hr/payroll/runs", {
      payrollPeriodId: periodId,
    }).expect(403);
    await post("teamlead", "/hr/payslips/generate", {
      payrollPeriodId: periodId,
    }).expect(403);
    await get("teamlead", "/hr/payment-batches").expect(403);
    await post("teamlead", "/hr/payment-batches", {
      payrollPeriodId: periodId,
    }).expect(403);
  });

  it("10. generates payslips only for the caller's organization", async () => {
    // The fixed permission: an org-wide payroll writer can (re)generate
    const res = await post("admin", "/hr/payslips/generate", {
      payrollPeriodId: periodId,
    }).expect(200);
    const rows = dataOf<Array<{ payslipNumber: string }>>(res);
    expect(rows).toHaveLength(2);

    // Another organization's period id is simply "not found" and creates nothing
    const before = await prisma.payslip.count({
      where: { payrollPeriodId: otherOrgPeriodId },
    });
    await post("admin", "/hr/payslips/generate", {
      payrollPeriodId: otherOrgPeriodId,
    }).expect(404);
    expect(
      await prisma.payslip.count({
        where: { payrollPeriodId: otherOrgPeriodId },
      }),
    ).toBe(before);
  });

  let junePeriodId: number;
  let loanId2: number;

  it("11. re-run supersedes the approved run; skips, loan closure, arrears and ESI bonus rules apply", async () => {
    // Loan for Employee 2, one installment due 2026-06-01
    const loan2 = await post("admin", "/hr/loans", {
      employeeId: employeeId2,
      principalAmount: 1000,
      emiAmount: 1000,
      emiMonths: 1,
      disbursedDate: "2026-05-01",
    }).expect(201);
    loanId2 = dataOf<{ id: number }>(loan2).id;

    // One-time arrears of 2000 for Employee 1
    await patch("admin", `/hr/salaries/${salaryId1}`, {
      arrearsSalary: 2000,
    }).expect(200);

    // Bonus of 1000 for Employee 2 (ESI-covered): not an ESI wage
    const bonus2 = await post("admin", "/hr/bonuses", {
      employeeId: employeeId2,
      bonusType: "FESTIVAL",
      amount: 1000,
    }).expect(201);
    await post(
      "checker",
      `/hr/bonuses/${dataOf<{ id: number }>(bonus2).id}/decide`,
      {
        decision: "APPROVED",
      },
    ).expect(200);

    junePeriodId = await createPeriod(6);

    // Skip June's EMI of loan 1: requested by admin, approved by checker
    const skip = await post("admin", `/hr/loans/${loanId1}/skip-request`, {
      payrollPeriodId: junePeriodId,
      reason: "Medical expenses",
    }).expect(201);
    const skipId = dataOf<{ id: number }>(skip).id;
    await post("admin", `/hr/loans/skip-requests/${skipId}/decide`, {
      decision: "APPROVED",
    }).expect(403);
    await post("checker", `/hr/loans/skip-requests/${skipId}/decide`, {
      decision: "APPROVED",
    }).expect(200);

    // The skipped installment is re-scheduled at the end, not forgiven
    const schedule = await prisma.loanRepayment.findMany({
      where: { loanId: loanId1 },
      orderBy: { installmentNo: "asc" },
    });
    expect(schedule).toHaveLength(13);
    expect(schedule.filter((r) => r.status === "SKIPPED")).toHaveLength(1);
    expect(schedule.filter((r) => r.status === "PENDING")).toHaveLength(11);
    expect(schedule[12]?.dueDate.toISOString().slice(0, 10)).toBe("2027-02-01");

    // Run #1, approved
    const run1 = await createRun(junePeriodId);
    await post("checker", `/hr/payroll/runs/${run1.id}/approve`).expect(200);

    // Re-running supersedes it: only one payable run per period
    const run2 = await createRun(junePeriodId);
    const run1After = dataOf<{ status: string }>(
      await get("admin", `/hr/payroll/runs/${run1.id}`).expect(200),
    );
    expect(run1After.status).toBe("CANCELLED");
    await post("checker", `/hr/payroll/runs/${run1.id}/approve`).expect(422);
    await post("checker", `/hr/payroll/runs/${run2.id}/approve`).expect(200);

    const june = await entriesOf(run2.id);
    const e1 = june.find((e) => e.employeeId === employeeId1);
    const e2 = june.find((e) => e.employeeId === employeeId2);
    // Employee 1: 50000 + 2000 arrears; PF 1800; loan skipped this month
    expect(Number(e1?.totalGrossEarnings)).toBe(52000);
    expect(e1?.deductions.some((d) => d.code === "LOAN")).toBe(false);
    expect(Number(e1?.netPayable)).toBe(50200);
    // Employee 2: 20000 + 1000 bonus; ESI on 20000 only (150) + loan 1000
    expect(Number(e2?.totalGrossEarnings)).toBe(21000);
    expect(Number(e2?.deductions.find((d) => d.code === "ESI")?.amount)).toBe(
      150,
    );
    expect(Number(e2?.totalDeductions)).toBe(1150);

    await post("admin", `/hr/payroll/periods/${junePeriodId}/finalize`).expect(
      200,
    );

    // Loan 2's only installment is paid, so the loan is closed
    const loan2After = dataOf<{ status: string }>(
      await get("admin", `/hr/loans/${loanId2}`).expect(200),
    );
    expect(loan2After.status).toBe("CLOSED");

    // Arrears are marked as paid by June
    const salary = await prisma.employeeSalary.findUniqueOrThrow({
      where: { id: salaryId1 },
    });
    expect(salary.arrearsPaidPeriodId).toBe(junePeriodId);
  });

  it("12. does not pay arrears, closed-loan EMIs or paid bonuses again", async () => {
    const julyPeriodId = await createPeriod(7);
    const run = await createRun(julyPeriodId);
    const july = await entriesOf(run.id);

    const e1 = july.find((e) => e.employeeId === employeeId1);
    expect(e1?.earnings.some((e) => e.code === "ARREARS")).toBe(false);
    expect(Number(e1?.totalGrossEarnings)).toBe(50000);
    // Loan 1 resumes: one installment
    expect(e1?.deductions.filter((d) => d.code === "LOAN")).toHaveLength(1);

    const e2 = july.find((e) => e.employeeId === employeeId2);
    expect(Number(e2?.totalGrossEarnings)).toBe(20000);
    expect(e2?.deductions.some((d) => d.code === "LOAN")).toBe(false);
    expect(Number(e2?.netPayable)).toBe(19850);
  });
});
