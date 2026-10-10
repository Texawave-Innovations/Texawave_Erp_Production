import type { Prisma } from "@texawave-erp/database";

/** Approved format: `EMP-` + a 6-digit, zero-padded, per-organization counter. */
export const EMPLOYEE_CODE_DOC_TYPE = "employee";
export const EMPLOYEE_CODE_PREFIX = "EMP-";
export const EMPLOYEE_CODE_PADDING = 6;

export function formatEmployeeCode(
  prefix: string,
  padding: number,
  issued: number,
): string {
  return `${prefix}${String(issued).padStart(padding, "0")}`;
}

/**
 * Issues the next employee code for an organization. MUST be called inside
 * the same transaction that inserts the employee.
 *
 * Why this is safe under concurrency (and why "count rows + 1" is not):
 * the `UPDATE … SET next_number = next_number + 1` takes a row lock on the
 * organization's counter. A second concurrent creator blocks on that lock
 * until the first transaction ends, then reads the already-incremented value —
 * so two creators can never be handed the same number. If the first
 * transaction rolls back (a validation error, a duplicate e-mail), its
 * increment rolls back with it, so no number is skipped either. The
 * `UNIQUE (organization_id, employee_code)` index is the independent
 * backstop.
 */
export async function issueEmployeeCode(
  tx: Prisma.TransactionClient,
  organizationId: number,
): Promise<string> {
  // Ensure the document sequence exists and is at least higher than any existing employee code in the org.
  // This prevents collision if an employee (such as Super Admin) was seeded or imported with EMP-000001.
  await tx.$executeRaw`
    INSERT INTO platform.document_sequences
      (organization_id, doc_type, prefix, padding, next_number, updated_at)
    SELECT
      ${organizationId}, ${EMPLOYEE_CODE_DOC_TYPE}, ${EMPLOYEE_CODE_PREFIX},
      ${EMPLOYEE_CODE_PADDING},
      COALESCE(
        (SELECT MAX(SUBSTRING(employee_code FROM '[0-9]+')::integer) + 1
           FROM hr.employees
          WHERE organization_id = ${organizationId}
            AND employee_code LIKE ${EMPLOYEE_CODE_PREFIX + "%"}),
        1
      ),
      now()
    ON CONFLICT (organization_id, doc_type) DO NOTHING`;

  // Advance next_number if existing employee codes exceeded the recorded counter
  await tx.$executeRaw`
    UPDATE platform.document_sequences
       SET next_number = GREATEST(
         next_number,
         COALESCE(
           (SELECT MAX(SUBSTRING(employee_code FROM '[0-9]+')::integer) + 1
              FROM hr.employees
             WHERE organization_id = ${organizationId}
               AND employee_code LIKE ${EMPLOYEE_CODE_PREFIX + "%"}),
           1
         )
       )
     WHERE organization_id = ${organizationId}
       AND doc_type = ${EMPLOYEE_CODE_DOC_TYPE}
       AND deleted_at IS NULL`;

  const rows = await tx.$queryRaw<
    Array<{ prefix: string; padding: number; issued: number }>
  >`
    UPDATE platform.document_sequences
       SET next_number = next_number + 1, updated_at = now()
     WHERE organization_id = ${organizationId}
        AND doc_type = ${EMPLOYEE_CODE_DOC_TYPE}
        AND deleted_at IS NULL
     RETURNING prefix, padding, next_number - 1 AS issued`;

  const row = rows[0];
  if (!row) {
    throw new Error(
      `No active employee-code sequence for organization ${organizationId}`,
    );
  }
  return formatEmployeeCode(row.prefix, row.padding, row.issued);
}
