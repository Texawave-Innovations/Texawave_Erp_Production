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
  meta?: { page: number; limit: number; total: number; totalPages: number };
}

const PERMS = [
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

describe("Payroll & Compliance (e2e)", () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let org: { id: number; slug: string };
  const tokens: Record<string, string> = {};
  const perm = new Map<string, number>();
  const rawSuffix = randomUUID().slice(0, 8);
  const suffix = rawSuffix.toUpperCase().replace(/[^A-Z0-9]/g, "X");

  let departmentId: number;
  let teamId: number;
  let designationId: number;
  let employmentTypeId: number;
  let employeeId1: number;
  let employeeId2: number;

  const auth = (who: string) => ({
    Authorization: `Bearer ${tokens[who] ?? ""}`,
  });
  const get = (who: string, path: string) =>
    request(app.getHttpServer()).get(path).set(auth(who));
  const post = (who: string, path: string, body: object = {}) =>
    request(app.getHttpServer()).post(path).set(auth(who)).send(body);
  const put = (who: string, path: string, body: object = {}) =>
    request(app.getHttpServer()).put(path).set(auth(who)).send(body);
  const dataOf = <T = Record<string, unknown>>(res: { body: unknown }): T =>
    (res.body as Body<T>).data;

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

    // Admin user with all permissions
    await mkUser("admin", PERMS);

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

    const d1 = dataOf<{ employeeId: number; grossMonthly: number | string }>(
      res1,
    );
    expect(d1.employeeId).toBe(employeeId1);
    expect(Number(d1.grossMonthly)).toBe(50000);

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

    // Bank details
    await put("admin", `/hr/bank-details/${employeeId1}`, {
      bankName: "HDFC Bank",
      accountNumber: "50100123456789",
      ifscCode: "HDFC0001234",
      panNumber: "ABCDE1234F",
      aadhaarNumber: "123456789012",
    }).expect(200);

    await put("admin", `/hr/bank-details/${employeeId2}`, {
      bankName: "State Bank of India",
      accountNumber: "20100123456789",
      ifscCode: "SBIN0001234",
    }).expect(200);
  });

  it("3. creates employee loan and approves bonus", async () => {
    // Create loan for Employee 1: 12000 with 1000 EMI
    const loanRes = await post("admin", "/hr/loans", {
      employeeId: employeeId1,
      principalAmount: 12000,
      emiAmount: 1000,
      emiMonths: 12,
      disbursedDate: "2026-01-01",
      reason: "Personal emergency",
    }).expect(201);

    const loanData = dataOf<{ loanNumber: string; repayments: unknown[] }>(
      loanRes,
    );
    expect(loanData.loanNumber).toMatch(/^LOAN-/);
    expect(loanData.repayments).toHaveLength(12);

    // Create and approve performance bonus for Employee 1: 5000
    const bonusRes = await post("admin", "/hr/bonuses", {
      employeeId: employeeId1,
      bonusType: "PERFORMANCE",
      amount: 5000,
      reason: "Q1 Outstanding Performance",
    }).expect(201);

    const bonusData = dataOf<{ id: number }>(bonusRes);
    await post("admin", `/hr/bonuses/${bonusData.id}/decide`, {
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

    const entriesRes = await get(
      "admin",
      `/hr/payroll/entries?payrollRunId=${runId}`,
    ).expect(200);
    interface EntryItem {
      employeeId: number;
      totalGrossEarnings: number | string;
      totalDeductions: number | string;
      netPayable: number | string;
    }
    const entries = dataOf<EntryItem[]>(entriesRes);
    expect(entries).toHaveLength(2);

    // Verify Employee 1 entry:
    // Base gross: 50000, Bonus: 5000 -> Total gross: 55000
    // PF: 1800, Loan EMI: 1000 -> Deductions: 2800
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

  it("6. approves run and finalizes period with auto-generated payslips", async () => {
    // Approve run
    await post("admin", `/hr/payroll/runs/${runId}/approve`, {
      notes: "Approved after HR audit",
    }).expect(200);

    // Finalize period
    const finalizeRes = await post(
      "admin",
      `/hr/payroll/periods/${periodId}/finalize`,
    ).expect(200);
    const finData = dataOf<{ status: string }>(finalizeRes);
    expect(finData.status).toBe("FINALIZED");

    // Verify payslips were auto-generated
    const payslipsRes = await get(
      "admin",
      `/hr/payslips?payrollPeriodId=${periodId}`,
    ).expect(200);
    interface PayslipItem {
      employeeId: number;
      netPayable: number | string;
      payslipNumber: string;
    }
    const payslips = dataOf<PayslipItem[]>(payslipsRes);
    expect(payslips).toHaveLength(2);

    const ps1 = payslips.find((p) => p.employeeId === employeeId1);
    expect(ps1).toBeDefined();
    expect(Number(ps1?.netPayable)).toBe(52200);
    expect(ps1?.payslipNumber).toMatch(/^PS-202605-/);
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
      payments: Array<{ status: string }>;
    }
    const bData = dataOf<BatchItem>(batchRes);
    const batchId = bData.id;
    expect(bData.totalEmployees).toBe(2);
    expect(Number(bData.totalAmount)).toBe(52200 + 19850);

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
});
