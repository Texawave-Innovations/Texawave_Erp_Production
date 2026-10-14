import { Prisma } from "@texawave-erp/database";

/** Run statuses whose entries are (or may still become) payable. */
export const LIVE_RUN_STATUSES = ["PROCESSED", "APPROVED"];

/**
 * Loan installments a run of `payrollPeriodId` may deduct: ones no live entry
 * of ANOTHER period has claimed. An installment linked to a cancelled entry,
 * or to this period's own (about to be superseded) run, is free again — so two
 * open periods never deduct the same EMI.
 */
export function installmentClaimableBy(
  payrollPeriodId: number,
): Prisma.LoanRepaymentWhereInput {
  return {
    OR: [
      { payrollEntryId: null },
      { payrollEntry: { status: "CANCELLED" } },
      { payrollEntry: { payrollRun: { payrollPeriodId } } },
    ],
  };
}

/**
 * Of `bonusIds`, the ones a live (non-cancelled) payroll entry of ANOTHER
 * period already pays — through a BONUS earning linked by `sourceId`. Those
 * must not be paid again by `payrollPeriodId`.
 */
export async function bonusesPaidElsewhere(
  db: Pick<Prisma.TransactionClient, "payrollEarning">,
  organizationId: number,
  payrollPeriodId: number,
  bonusIds: number[],
): Promise<Set<number>> {
  if (bonusIds.length === 0) return new Set();
  const rows = await db.payrollEarning.findMany({
    where: {
      organizationId,
      sourceType: "BONUS",
      sourceId: { in: bonusIds },
      deletedAt: null,
      payrollEntry: {
        status: { not: "CANCELLED" },
        payrollRun: { payrollPeriodId: { not: payrollPeriodId } },
      },
    },
    select: { sourceId: true },
  });
  return new Set(
    rows.map((r) => r.sourceId).filter((id): id is number => id !== null),
  );
}

/**
 * Takes a period's live (PROCESSED/APPROVED) runs out of play: their entries
 * and runs become CANCELLED, the loan installments they deducted are released,
 * their payslips are voided (so employees never see a superseded payslip) and
 * their PF/ESI snapshots are retired (a re-run revives the ones it recomputes).
 * Returns the cancelled run ids. MUST run inside a transaction that already
 * holds the period lock (`lockPayrollPeriod`).
 */
export async function cancelLiveRuns(
  tx: Prisma.TransactionClient,
  organizationId: number,
  payrollPeriodId: number,
  userId: number,
): Promise<number[]> {
  const live = await tx.payrollRun.findMany({
    where: {
      organizationId,
      payrollPeriodId,
      status: { in: LIVE_RUN_STATUSES },
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  const runIds = live.map((r) => r.id);
  if (runIds.length === 0) return runIds;

  const ofTheseRuns = { payrollEntry: { payrollRunId: { in: runIds } } };
  const now = new Date();

  await tx.loanRepayment.updateMany({
    where: { organizationId, status: "PENDING", ...ofTheseRuns },
    data: { payrollEntryId: null, updatedBy: userId },
  });
  await tx.payslip.updateMany({
    where: { organizationId, deletedAt: null, ...ofTheseRuns },
    data: { status: "VOID", deletedAt: now, updatedBy: userId },
  });
  await tx.pfContribution.updateMany({
    where: { organizationId, payrollPeriodId, deletedAt: null, ...ofTheseRuns },
    data: { deletedAt: now, updatedBy: userId },
  });
  await tx.esiContribution.updateMany({
    where: { organizationId, payrollPeriodId, deletedAt: null, ...ofTheseRuns },
    data: { deletedAt: now, updatedBy: userId },
  });
  await tx.payrollEntry.updateMany({
    where: { payrollRunId: { in: runIds } },
    data: { status: "CANCELLED", updatedBy: userId },
  });
  await tx.payrollRun.updateMany({
    where: { id: { in: runIds } },
    data: { status: "CANCELLED", updatedBy: userId },
  });
  return runIds;
}
