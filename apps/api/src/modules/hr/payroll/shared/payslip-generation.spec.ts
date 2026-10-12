import { beforeEach, describe, expect, it, vi } from "vitest";
import { BusinessRuleViolationException } from "../../../../common/exceptions/business.exception.js";
import { issuePayrollNumber } from "./payroll-locks.js";
import {
  findApprovedRun,
  generatePayslipsForRun,
} from "./payslip-generation.js";

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
  });

  function makeTx(
    entries: Array<{ id: number; employeeId: number; netPayable: string }>,
    existing: Array<{ id: number; payrollEntryId: number }>,
  ) {
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

  it("creates numbered payslips for new entries and refreshes existing ones", async () => {
    const tx = makeTx(
      [
        { id: 1, employeeId: 11, netPayable: "1000.00" },
        { id: 2, employeeId: 12, netPayable: "2000.00" },
        { id: 3, employeeId: 13, netPayable: "3000.00" },
      ],
      [{ id: 77, payrollEntryId: 2 }],
    );
    issueMock.mockResolvedValueOnce(5).mockResolvedValueOnce(123456);

    const ids = await generatePayslipsForRun(
      tx as never,
      ORG_ID,
      PERIOD,
      9,
      USER_ID,
    );

    expect(ids).toEqual([500, 77, 501]);

    expect(tx.payrollEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG_ID, payrollRunId: 9, deletedAt: null },
      }),
    );
    expect(tx.payslip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: ORG_ID, payrollEntryId: { in: [1, 2, 3] } },
      }),
    );

    // existing payslip refreshed, not renumbered
    expect(tx.payslip.update).toHaveBeenCalledOnce();
    expect(tx.payslip.update).toHaveBeenCalledWith({
      where: { id: 77 },
      data: { netPayable: "2000.00", updatedBy: USER_ID },
    });

    expect(issueMock).toHaveBeenCalledTimes(2);
    expect(issueMock).toHaveBeenCalledWith(tx, ORG_ID, "payslip");
    expect(tx.payslip.create).toHaveBeenCalledTimes(2);
    expect(tx.payslip.create.mock.calls[0]![0]).toEqual({
      data: {
        organizationId: ORG_ID,
        payrollPeriodId: PERIOD.id,
        payrollEntryId: 1,
        employeeId: 11,
        payslipNumber: "PS-202604-000005",
        netPayable: "1000.00",
        status: "GENERATED",
        createdBy: USER_ID,
        updatedBy: USER_ID,
      },
      select: { id: true },
    });
    expect(tx.payslip.create.mock.calls[1]![0]).toMatchObject({
      data: { payslipNumber: "PS-202604-123456", employeeId: 13 },
    });
  });

  it("returns an empty list and issues no numbers for a run with no entries", async () => {
    const tx = makeTx([], []);
    const ids = await generatePayslipsForRun(
      tx as never,
      ORG_ID,
      PERIOD,
      9,
      USER_ID,
    );
    expect(ids).toEqual([]);
    expect(issueMock).not.toHaveBeenCalled();
    expect(tx.payslip.create).not.toHaveBeenCalled();
  });
});
