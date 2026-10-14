import type { Prisma } from "@texawave-erp/database";
import { BusinessRuleViolationException } from "../../../../common/exceptions/business.exception.js";
import {
  issuePayrollNumber,
  periodTag,
  type LockedPayrollPeriod,
} from "./payroll-locks.js";
import { buildPayslipSnapshots, sameSnapshot } from "./payslip-snapshot.js";

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

export const MIN_REGENERATION_REASON = 10;

/**
 * Creates (or refreshes) one payslip per entry of the given run, each with a
 * frozen snapshot of its content (`payslip-snapshot.ts`). The ONLY place
 * payslips are generated — used by period finalization and by the explicit
 * generate / regenerate endpoints. MUST run inside a transaction that
 * already holds the period lock (`lockPayrollPeriod`).
 *
 * An existing payslip whose content would change is a regeneration: its
 * version goes up, the change needs a `reason` (refused without one), and
 * its stored PDF is dropped so the next download renders the new content.
 * One whose content is unchanged is left exactly as it is. `entryIds`
 * limits the work to some entries of the run (single regeneration).
 */
export async function generatePayslipsForRun(
  tx: Prisma.TransactionClient,
  organizationId: number,
  period: LockedPayrollPeriod,
  payrollRunId: number,
  userId: number,
  reason?: string,
  entryIds?: number[],
): Promise<{ ids: number[]; regeneratedIds: number[] }> {
  const entries = await tx.payrollEntry.findMany({
    where: {
      organizationId,
      payrollRunId,
      deletedAt: null,
      ...(entryIds ? { id: { in: entryIds } } : {}),
    },
    select: { id: true, employeeId: true, netPayable: true },
    orderBy: { id: "asc" },
  });

  const existing = await tx.payslip.findMany({
    where: {
      organizationId,
      payrollEntryId: { in: entries.map((e) => e.id) },
    },
    select: { id: true, payrollEntryId: true, snapshot: true },
  });
  const existingByEntry = new Map(existing.map((p) => [p.payrollEntryId, p]));
  const snapshots = await buildPayslipSnapshots(
    tx,
    organizationId,
    entries.map((e) => e.id),
  );

  const ids: number[] = [];
  const regeneratedIds: number[] = [];
  for (const entry of entries) {
    const snapshot = snapshots.get(entry.id);
    if (!snapshot) continue;
    const json = snapshot as unknown as Prisma.InputJsonValue;
    const current = existingByEntry.get(entry.id);
    if (current !== undefined) {
      ids.push(current.id);
      if (
        current.snapshot !== null &&
        sameSnapshot(current.snapshot, snapshot)
      ) {
        continue;
      }
      if (current.snapshot === null) {
        // Generated before snapshots existed: freeze it now, same version.
        await tx.payslip.update({
          where: { id: current.id },
          data: {
            netPayable: entry.netPayable,
            snapshot: json,
            updatedBy: userId,
          },
        });
        continue;
      }
      if (!reason || reason.trim().length < MIN_REGENERATION_REASON) {
        throw new BusinessRuleViolationException(
          `A generated payslip would change. Give a reason (at least ${MIN_REGENERATION_REASON} characters) to regenerate it.`,
          "PAYSLIP_REGENERATION_REASON_REQUIRED",
        );
      }
      await tx.payslip.update({
        where: { id: current.id },
        data: {
          netPayable: entry.netPayable,
          snapshot: json,
          version: { increment: 1 },
          regeneratedAt: new Date(),
          regenerationReason: reason.trim(),
          pdfContent: null,
          pdfRenderedAt: null,
          updatedBy: userId,
        },
      });
      regeneratedIds.push(current.id);
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
        snapshot: json,
        createdBy: userId,
        updatedBy: userId,
      },
      select: { id: true },
    });
    ids.push(created.id);
  }
  return { ids, regeneratedIds };
}
