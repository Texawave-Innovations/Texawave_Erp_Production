import type { Prisma } from "@texawave-erp/database";
import {
  type CodeFormat,
  formatCode,
  sequenceDocType,
} from "../master-list/code-formats.rules.js";

/**
 * Issues the next customer code, `<PREFIX>-<COUNTRY>-<NUMBER>` (CUS-IN-001),
 * from a per-organization, per-country counter in
 * `platform.document_sequences` (doc type `sales_customer_IN`). The prefix
 * and width come from the Sales master list at the moment of issue.
 *
 * MUST run inside the transaction that inserts the customer: the UPDATE locks
 * the counter row, so concurrent creators queue on it and never get the same
 * number, and a rolled-back insert rolls its number back.
 * `UNIQUE (organization_id, customer_code)` is the backstop.
 */
export async function issueCustomerCode(
  tx: Prisma.TransactionClient,
  organizationId: number,
  country: string,
  format: CodeFormat,
): Promise<string> {
  const docType = sequenceDocType("customer", country);
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
  return formatCode(format, country, row.issued);
}
