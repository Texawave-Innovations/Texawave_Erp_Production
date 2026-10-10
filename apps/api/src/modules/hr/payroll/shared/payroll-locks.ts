import type { Prisma } from "@texawave-erp/database";

export interface LockedPayrollPeriod {
  id: number;
  year: number;
  month: number;
  status: string;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Takes a row lock on the payroll period (`SELECT … FOR UPDATE`) for the rest
 * of the transaction and returns it, or `null` for a missing id AND for
 * another organization's id (callers treat both as "not found").
 *
 * Every state change of a period — creating/approving a run, finalizing,
 * generating payslips, creating a payment batch — locks first and re-checks
 * status afterwards, so two concurrent requests run one after the other
 * against fresh data instead of both passing a stale check (e.g. two payout
 * batches for one month).
 */
export async function lockPayrollPeriod(
  tx: Prisma.TransactionClient,
  organizationId: number,
  payrollPeriodId: number,
): Promise<LockedPayrollPeriod | null> {
  const rows = await tx.$queryRaw<LockedPayrollPeriod[]>`
    SELECT id, year, month, status,
           period_start AS "periodStart", period_end AS "periodEnd"
      FROM hr.payroll_periods
     WHERE id = ${payrollPeriodId}
       AND organization_id = ${organizationId}
       AND deleted_at IS NULL
       FOR UPDATE`;
  return rows[0] ?? null;
}

export type PayrollDocType = "payslip" | "payment_batch" | "employee_loan";

const PREFIX: Record<PayrollDocType, string> = {
  payslip: "PS-",
  payment_batch: "BATCH-",
  employee_loan: "LOAN-",
};

/**
 * Issues the next per-organization number for a payroll document from
 * `document_sequences` — same mechanism and concurrency argument as
 * `issueEmployeeCode` (employees/employee-code.ts): the UPDATE row-locks the
 * counter, so concurrent callers never get the same number and a rollback
 * gives the number back. MUST be called inside the inserting transaction.
 */
export async function issuePayrollNumber(
  tx: Prisma.TransactionClient,
  organizationId: number,
  docType: PayrollDocType,
): Promise<number> {
  await tx.$executeRaw`
    INSERT INTO platform.document_sequences
      (organization_id, doc_type, prefix, padding, next_number, updated_at)
    VALUES (${organizationId}, ${docType}, ${PREFIX[docType]}, 6, 1, now())
    ON CONFLICT (organization_id, doc_type) DO NOTHING`;

  const rows = await tx.$queryRaw<Array<{ issued: number }>>`
    UPDATE platform.document_sequences
       SET next_number = next_number + 1, updated_at = now()
     WHERE organization_id = ${organizationId}
       AND doc_type = ${docType}
       AND deleted_at IS NULL
    RETURNING next_number - 1 AS issued`;

  const row = rows[0];
  if (!row) {
    throw new Error(
      `No active ${docType} sequence for organization ${organizationId}`,
    );
  }
  return Number(row.issued);
}

export function periodTag(period: { year: number; month: number }): string {
  return `${period.year}${String(period.month).padStart(2, "0")}`;
}
