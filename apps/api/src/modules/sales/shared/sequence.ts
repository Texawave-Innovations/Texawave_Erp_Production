import type { Prisma } from "@texawave-erp/database";
import type { CodeFormat } from "../master-list/code-formats.rules.js";

/**
 * Takes the next number from the `platform.document_sequences` counter
 * `docType` (created at 1 on first use) and returns it.
 *
 * MUST run inside the transaction that inserts the record carrying the
 * number: the UPDATE locks the counter row, so concurrent creators queue on
 * it and never get the same number, and a rolled-back insert rolls its
 * number back. A UNIQUE index on the issued code is the backstop.
 */
export async function takeSequenceNumber(
  tx: Prisma.TransactionClient,
  organizationId: number,
  docType: string,
  format: CodeFormat,
): Promise<number> {
  await tx.$executeRaw`
    INSERT INTO platform.document_sequences
      (organization_id, doc_type, prefix, padding, next_number, updated_at)
    VALUES
      (${organizationId}, ${docType}, ${format.prefix}, ${format.padding}, 1, now())
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
  return row.issued;
}
