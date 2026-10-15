import type { Prisma } from "@texawave-erp/database";
import {
  type CodeFormat,
  formatCode,
  sequenceDocType,
} from "../master-list/code-formats.rules.js";
import { takeSequenceNumber } from "../shared/sequence.js";

/**
 * Issues the next customer code, `<PREFIX>-<COUNTRY>-<NUMBER>` (CUS-IN-001),
 * from a per-organization, per-country counter (doc type
 * `sales_customer_IN`). The prefix and width come from the Sales master list
 * at the moment of issue.
 *
 * MUST run inside the transaction that inserts the customer (see
 * `takeSequenceNumber`). `UNIQUE (organization_id, customer_code)` is the
 * backstop.
 */
export async function issueCustomerCode(
  tx: Prisma.TransactionClient,
  organizationId: number,
  country: string,
  format: CodeFormat,
): Promise<string> {
  const issued = await takeSequenceNumber(
    tx,
    organizationId,
    sequenceDocType("customer", country),
    format,
  );
  return formatCode(format, country, issued);
}
