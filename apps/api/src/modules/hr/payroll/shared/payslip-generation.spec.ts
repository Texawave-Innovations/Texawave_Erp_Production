import { beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessRuleViolationException } from "../../../../common/exceptions/business.exception.js";
import { issuePayrollNumber } from "./payroll-locks.js";
import {
  findApprovedRun,
  generatePayslipsForRun,
} from "./payslip-generation.js";

vi.mock("./payslip-snapshot.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./payslip-snapshot.js")>();
  return {
    ...actual,
    // One snapshot per entry, its content driven by the entry net pay.
    buildPayslipSnapshots: vi.fn((_tx: unknown, _org: number, ids: number[]) =>
      Promise.resolve(
        new Map(ids.map((id) => [id, { entry: id, net: netOf.get(id) }])),
      ),
    ),
  };
});

const netOf = new Map<number, string>();

vi.mock("./payroll-locks.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./payroll-locks.js")>();
  return { ...actual, issuePayrollNumber: vi.fn() };
});

const ORG_ID = 1;
const USER_ID = 42;
const PERIOD = {
  id: 10,
  year: 2026,
  month: 4,
  status: "DRAFT",
  periodStart: new Date("2026-04-01"),
  periodEnd: new Date("2026-04-30"),
};

describe("findApprovedRun", () => {
  it("returns the latest approved run for the period within the organization", async () => {
    const run = { id: 3, runNumber: 2, status: "APPROVED" };
    const tx = { payrollRun: { findFirst: vi.fn().mockResolvedValue(run) } };

    await expect(findApprovedRun(tx as never, ORG_ID, 10)).resolves.toBe(run);
    expect(tx.payrollRun.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: ORG_ID,
        payrollPeriodId: 10,
        status: "APPROVED",
        deletedAt: null,
      },
      orderBy: { runNumber: "desc" },
    });
  });

  it("throws NO_APPROVED_RUN when there is none", async () => {
    const tx = { payrollRun: { findFirst: vi.fn().mockResolvedValue(null) } };
    const err = await findApprovedRun(tx as never, ORG_ID, 10).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(BusinessRuleViolationException);
    expect((err as BusinessRuleViolationException).errorCode).toBe(
      "NO_APPROVED_RUN",
    );
  });
});

describe("generatePayslipsForRun", () => {
  const issueMock = vi.mocked(issuePayrollNumber);

  beforeEach(() => {
    issueMock.mockReset();
    netOf.clear();
  });

  function makeTx(
    entries: Array<{ id: number; employeeId: number; netPayable: string }>,
    existing: Array<{ id: number; payrollEntryId: number; snapshot: unknown }>,
  ) {
    for (const e of entries) netOf.set(e.id, e.netPayable);
    let nextId = 500;
    return {
      payrollEntry: { findMany: vi.fn().mockResolvedValue(entries) },
      payslip: {
        findMany: vi.fn().mockResolvedValue(existing),
        update: vi.fn().mockResolvedValue({}),
        create: vi.fn().mockImplementation(() => ({ id: nextId++ })),
      },
    };
  }

  it("creates numbered payslips with a frozen snapshot; leaves unchanged ones alone", async () => {
    const tx = makeTx(
      [
        { id: 1, employeeId: 11, netPayable: "1000.00" },
        { id: 2, employeeId: 12, netPayable: "2000.00" },
        { id: 3, employeeId: 13, netPayable: "3000.00" },
      ],
      [{ id: 77, payrollEntryId: 2, snapshot: { entry: 2, net: "2000.00" } }],
    );
    issueMock.mockResolvedValueOnce(5).mockResolvedValueOnce(123456);

    const res = await generatePayslipsForRun(
      tx as never,
      ORG_ID,
      PERIOD,
      9,
      USER_ID,
    );

    expect(res).toEqual({ ids: [500, 77, 501], regeneratedIds: [] });
    expect(tx.payslip.update).not.toHaveBeenCalled();
    expect(issueMock).toHaveBeenCalledWith(tx, ORG_ID, "payslip");
    expect(tx.payslip.create.mock.calls[0]![0]).toEqual({
      data: {
        organizationId: ORG_ID,
        payrollPeriodId: PERIOD.id,
        payrollEntryId: 1,
        employeeId: 11,
        payslipNumber: "PS-202604-000005",
        netPayable: "1000.00",
        status: "GENERATED",
        snapshot: { entry: 1, net: "1000.00" },
        createdBy: USER_ID,
        updatedBy: USER_ID,
      },
      select: { id: true },
    });
    expect(tx.payslip.create.mock.calls[1]![0]).toMatchObject({
      data: { payslipNumber: "PS-202604-123456", employeeId: 13 },
    });
  });

  it("freezes a payslip generated before snapshots, without a new version", async () => {
    const tx = makeTx(
      [{ id: 2, employeeId: 12, netPayable: "2000.00" }],
      [{ id: 77, payrollEntryId: 2, snapshot: null }],
    );
    await generatePayslipsForRun(tx as never, ORG_ID, PERIOD, 9, USER_ID);
    expect(tx.payslip.update).toHaveBeenCalledWith({
      where: { id: 77 },
      data: {
        netPayable: "2000.00",
        snapshot: { entry: 2, net: "2000.00" },
        updatedBy: USER_ID,
      },
    });
  });

  it("refuses to change an issued payslip without a reason", async () => {
    const tx = makeTx(
      [{ id: 2, employeeId: 12, netPayable: "2500.00" }],
      [{ id: 77, payrollEntryId: 2, snapshot: { entry: 2, net: "2000.00" } }],
    );
    const err = await generatePayslipsForRun(
      tx as never,
      ORG_ID,
      PERIOD,
      9,
      USER_ID,
    ).catch((e: unknown) => e);
    expect((err as BusinessRuleViolationException).errorCode).toBe(
      "PAYSLIP_REGENERATION_REASON_REQUIRED",
    );
    expect(tx.payslip.update).not.toHaveBeenCalled();
  });

  it("regenerates a changed payslip as a new version with the reason and drops its PDF", async () => {
    const tx = makeTx(
      [{ id: 2, employeeId: 12, netPayable: "2500.00" }],
      [{ id: 77, payrollEntryId: 2, snapshot: { entry: 2, net: "2000.00" } }],
    );
    const res = await generatePayslipsForRun(
      tx as never,
      ORG_ID,
      PERIOD,
      9,
      USER_ID,
      "  Bank account corrected  ",
    );
    expect(res.regeneratedIds).toEqual([77]);
    expect(tx.payslip.update.mock.calls[0]![0]).toMatchObject({
      where: { id: 77 },
      data: {
        version: { increment: 1 },
        regenerationReason: "Bank account corrected",
        pdfContent: null,
        pdfRenderedAt: null,
      },
    });
  });

  it("returns empty lists and issues no numbers for a run with no entries", async () => {
    const tx = makeTx([], []);
    const res = await generatePayslipsForRun(
      tx as never,
      ORG_ID,
      PERIOD,
      9,
      USER_ID,
    );
    expect(res).toEqual({ ids: [], regeneratedIds: [] });
    expect(issueMock).not.toHaveBeenCalled();
  });
});
