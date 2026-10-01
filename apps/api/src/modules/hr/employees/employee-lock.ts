import type { Prisma } from "@texawave-erp/database";

/**
 * Takes a row lock on the employee (`SELECT … FOR UPDATE`) for the rest of
 * the transaction and reports whether it exists in this organization.
 *
 * Every mutating operation (update, status change, user link) locks first and
 * re-reads afterwards, so two concurrent changes to one employee run one after
 * the other against fresh data — never interleaved on a stale read. Returns
 * `false` for a missing id AND for another organization's id: callers treat
 * both as "not found".
 */
export async function lockEmployee(
  tx: Prisma.TransactionClient,
  organizationId: number,
  employeeId: number,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: number }>>`
    SELECT id FROM employees
     WHERE id = ${employeeId}
       AND organization_id = ${organizationId}
       AND deleted_at IS NULL
       FOR UPDATE`;
  return rows.length > 0;
}
