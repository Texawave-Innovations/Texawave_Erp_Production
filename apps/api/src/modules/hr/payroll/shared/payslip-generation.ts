import type { Prisma } from "@texawave-erp/database";
import { BusinessRuleViolationException } from "../../../../common/exceptions/business.exception.js";
import {
  issuePayrollNumber,
  periodTag,
  type LockedPayrollPeriod,
} from "./payroll-locks.js";

/**
 * The period's single APPROVED run (runs are superseded on re-run, so there
 * is at most one), filtered by organization. Throws when there is none.
 */
export async function findApprovedRun(
  tx: Prisma.TransactionClient,
  organizationId: number,
  payrollPeriodId: number,
) {
  const run = await tx.payrollRun.findFirst({
    where: {
      organizationId,
      payrollPeriodId,
      status: "APPROVED",
      deletedAt: null,
    },
    orderBy: { runNumber: "desc" },
  });
  if (!run) {
    throw new BusinessRuleViolationException(
      "No approved payroll run exists for this period",
      "NO_APPROVED_RUN",
    );
  }
  return run;
}

/**
 * Creates (or refreshes) one payslip per entry of the given run. The ONLY
 * place payslips are generated — used by period finalization and by the
 * explicit generate endpoint. MUST run inside a transaction that already
 * holds the period lock (`lockPayrollPeriod`).
 */
export async function generatePayslipsForRun(
  tx: Prisma.TransactionClient,
  organizationId: number,
  period: LockedPayrollPeriod,
  payrollRunId: number,
  userId: number,
): Promise<number[]> {
  const entries = await tx.payrollEntry.findMany({
    where: { organizationId, payrollRunId, deletedAt: null },
    select: { id: true, employeeId: true, netPayable: true },
    orderBy: { id: "asc" },
  });

  const existing = await tx.payslip.findMany({
    where: {
      organizationId,
      payrollEntryId: { in: entries.map((e) => e.id) },
    },
    select: { id: true, payrollEntryId: true },
  });
  const existingByEntry = new Map(
    existing.map((p) => [p.payrollEntryId, p.id]),
  );

  const ids: number[] = [];
  for (const entry of entries) {
    const existingId = existingByEntry.get(entry.id);
    if (existingId !== undefined) {
      await tx.payslip.update({
        where: { id: existingId },
        data: { netPayable: entry.netPayable, updatedBy: userId },
      });
      ids.push(existingId);
      continue;
    }

    const seq = await issuePayrollNumber(tx, organizationId, "payslip");
    const created = await tx.payslip.create({
      data: {
        organizationId,
        payrollPeriodId: period.id,
        payrollEntryId: entry.id,
        employeeId: entry.employeeId,
        payslipNumber: `PS-${periodTag(period)}-${String(seq).padStart(6, "0")}`,
        netPayable: entry.netPayable,
        status: "GENERATED",
        createdBy: userId,
        updatedBy: userId,
      },
      select: { id: true },
    });
    ids.push(created.id);
  }
  return ids;
}
