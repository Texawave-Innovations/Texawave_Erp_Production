import type { Prisma } from "@texawave-erp/database";

export const PROJECT_CODE_DOC_TYPE = "project";
export const PROJECT_CODE_PREFIX = "PRJ-";
export const PROJECT_CODE_PADDING = 6;

export const TASK_CODE_DOC_TYPE = "project_task";
export const TASK_CODE_PREFIX = "TSK-";
export const TASK_CODE_PADDING = 6;

export function formatCode(
  prefix: string,
  padding: number,
  issued: number,
): string {
  return `${prefix}${String(issued).padStart(padding, "0")}`;
}

/**
 * Issues the next sequential project code (e.g. `PRJ-000001`) under a PostgreSQL row lock
 * on `platform.document_sequences`. Concurrency-safe and atomic inside a transaction.
 */
export async function issueProjectCode(
  tx: Prisma.TransactionClient,
  organizationId: number,
): Promise<string> {
  await tx.$executeRaw`
    INSERT INTO platform.document_sequences
      (organization_id, doc_type, prefix, padding, next_number, updated_at)
    SELECT
      ${organizationId}, ${PROJECT_CODE_DOC_TYPE}, ${PROJECT_CODE_PREFIX},
      ${PROJECT_CODE_PADDING},
      COALESCE(
        (SELECT MAX(SUBSTRING(project_code FROM '[0-9]+')::integer) + 1
           FROM projects.project_records
          WHERE organization_id = ${organizationId}
            AND project_code LIKE ${PROJECT_CODE_PREFIX + "%"}),
        1
      ),
      now()
    ON CONFLICT (organization_id, doc_type) DO NOTHING`;

  await tx.$executeRaw`
    UPDATE platform.document_sequences
       SET next_number = GREATEST(
         next_number,
         COALESCE(
           (SELECT MAX(SUBSTRING(project_code FROM '[0-9]+')::integer) + 1
              FROM projects.project_records
             WHERE organization_id = ${organizationId}
               AND project_code LIKE ${PROJECT_CODE_PREFIX + "%"}),
           1
         )
       )
     WHERE organization_id = ${organizationId}
       AND doc_type = ${PROJECT_CODE_DOC_TYPE}
       AND deleted_at IS NULL`;

  const rows = await tx.$queryRaw<
    Array<{ prefix: string; padding: number; issued: number }>
  >`
    UPDATE platform.document_sequences
       SET next_number = next_number + 1, updated_at = now()
     WHERE organization_id = ${organizationId}
       AND doc_type = ${PROJECT_CODE_DOC_TYPE}
       AND deleted_at IS NULL
     RETURNING prefix, padding, next_number - 1 AS issued`;

  const row = rows[0];
  if (!row) {
    throw new Error(
      `No active project sequence for organization ${organizationId}`,
    );
  }
  return formatCode(row.prefix, row.padding, row.issued);
}

/**
 * Issues the next sequential task code (e.g. `TSK-000001`) under a PostgreSQL row lock.
 */
export async function issueTaskCode(
  tx: Prisma.TransactionClient,
  organizationId: number,
): Promise<string> {
  await tx.$executeRaw`
    INSERT INTO platform.document_sequences
      (organization_id, doc_type, prefix, padding, next_number, updated_at)
    SELECT
      ${organizationId}, ${TASK_CODE_DOC_TYPE}, ${TASK_CODE_PREFIX},
      ${TASK_CODE_PADDING},
      COALESCE(
        (SELECT MAX(SUBSTRING(task_code FROM '[0-9]+')::integer) + 1
           FROM projects.project_tasks
          WHERE organization_id = ${organizationId}
            AND task_code LIKE ${TASK_CODE_PREFIX + "%"}),
        1
      ),
      now()
    ON CONFLICT (organization_id, doc_type) DO NOTHING`;

  await tx.$executeRaw`
    UPDATE platform.document_sequences
       SET next_number = GREATEST(
         next_number,
         COALESCE(
           (SELECT MAX(SUBSTRING(task_code FROM '[0-9]+')::integer) + 1
              FROM projects.project_tasks
             WHERE organization_id = ${organizationId}
               AND task_code LIKE ${TASK_CODE_PREFIX + "%"}),
           1
         )
       )
     WHERE organization_id = ${organizationId}
       AND doc_type = ${TASK_CODE_DOC_TYPE}
       AND deleted_at IS NULL`;

  const rows = await tx.$queryRaw<
    Array<{ prefix: string; padding: number; issued: number }>
  >`
    UPDATE platform.document_sequences
       SET next_number = next_number + 1, updated_at = now()
     WHERE organization_id = ${organizationId}
       AND doc_type = ${TASK_CODE_DOC_TYPE}
       AND deleted_at IS NULL
     RETURNING prefix, padding, next_number - 1 AS issued`;

  const row = rows[0];
  if (!row) {
    throw new Error(
      `No active task sequence for organization ${organizationId}`,
    );
  }
  return formatCode(row.prefix, row.padding, row.issued);
}
