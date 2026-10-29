import type { Prisma } from "@texawave-erp/database";

/** Issues the next sequential MoM reference (`MOM-YYYY-NNNN`) under a
 * PostgreSQL row lock on `platform.document_sequences`, one counter per
 * calendar year — replaces legacy's `mom_counters/{year}` RTDB path. */
export async function issueMomReference(
  tx: Prisma.TransactionClient,
  organizationId: number,
  now: Date = new Date(),
): Promise<string> {
  const year = now.getUTCFullYear();
  const docType = `mom_${year}`;
  const prefix = `MOM-${year}-`;
  const padding = 4;

  await tx.$executeRaw`
    INSERT INTO platform.document_sequences
      (organization_id, doc_type, prefix, padding, next_number, updated_at)
    VALUES (${organizationId}, ${docType}, ${prefix}, ${padding}, 1, now())
    ON CONFLICT (organization_id, doc_type) DO NOTHING`;

  const rows = await tx.$queryRaw<
    Array<{ prefix: string; padding: number; issued: number }>
  >`
    UPDATE platform.document_sequences
       SET next_number = next_number + 1, updated_at = now()
     WHERE organization_id = ${organizationId}
       AND doc_type = ${docType}
       AND deleted_at IS NULL
     RETURNING prefix, padding, next_number - 1 AS issued`;

  const row = rows[0];
  if (!row) {
    throw new Error(
      `No active MoM sequence for organization ${organizationId}`,
    );
  }
  return `${row.prefix}${String(row.issued).padStart(row.padding, "0")}`;
}
