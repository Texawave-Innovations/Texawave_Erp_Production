import type { Prisma } from "@texawave-erp/database";

/** Legacy `ProposalSettings` (prefix/yearFormat/sequenceDigits) — the counter
 * resets every calendar year when `yearFormat !== "NONE"` (doc_type embeds
 * the year), matching legacy's per-year numbering expectation. */
export interface ProposalNumberFormat {
  prefix: string;
  yearFormat: "YYYY" | "YY" | "NONE";
  sequenceDigits: number;
}

function yearPart(format: ProposalNumberFormat["yearFormat"], date: Date) {
  const year = date.getUTCFullYear();
  if (format === "YYYY") return String(year);
  if (format === "YY") return String(year).slice(-2);
  return null;
}

/** Issues the next sequential proposal number (e.g. `PROP-2026-0001`) under a
 * PostgreSQL row lock on `platform.document_sequences`. Concurrency-safe and
 * atomic inside a transaction — replaces legacy's ad-hoc
 * `ProposalSettings.nextSequence` counter. */
export async function issueProposalNumber(
  tx: Prisma.TransactionClient,
  organizationId: number,
  format: ProposalNumberFormat,
  now: Date = new Date(),
): Promise<string> {
  const yp = yearPart(format.yearFormat, now);
  const docType = yp ? `proposal_${yp}` : "proposal";
  const prefix = yp ? `${format.prefix}-${yp}-` : `${format.prefix}-`;
  const padding = format.sequenceDigits;

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
      `No active proposal sequence for organization ${organizationId}`,
    );
  }
  return `${row.prefix}${String(row.issued).padStart(row.padding, "0")}`;
}
