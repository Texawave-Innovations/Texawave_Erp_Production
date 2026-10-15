import type { Prisma } from "@texawave-erp/database";
import {
  type CodeFormat,
  type DocumentCodeType,
  documentSequenceDocType,
  formatDocumentNumber,
} from "../master-list/code-formats.rules.js";
import { takeSequenceNumber } from "../shared/sequence.js";
import type {
  CustomerSnapshot,
  PricedColumns,
  PricedLine,
} from "./documents.rules.js";

/**
 * Helpers for the Sales document repositories (this module only). They take
 * the caller's transaction client — they never open one or reach Prisma on
 * their own.
 */

export interface BankDetails {
  bankName?: string | undefined;
  accountNumber?: string | undefined;
  branch?: string | undefined;
  ifsc?: string | undefined;
}

/** Every column a quotation or invoice shares, as the service resolved it. */
export interface DocumentData extends PricedColumns {
  customerId: number;
  customerSnapshot: CustomerSnapshot;
  transportDescription: string | null;
  transportHsn: string | null;
  bankDetails: BankDetails | null;
  sealName: string | null;
  signatureName: string | null;
  sealItemId: number | null;
  signatureItemId: number | null;
  preparedBy: string | null;
  terms: string | null;
  customFields: Record<string, unknown>;
  lines: PricedLine[];
}

export interface DocumentFilter {
  search?: string | undefined;
  customerId?: number | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
}

export const liveLines = {
  where: { deletedAt: null },
  orderBy: { lineNo: "asc" },
} as const;

/** Issues `<PREFIX>/<FY>/<NNNN>` from the type's counter for that financial
 * year. Must run in the transaction that inserts the document. */
export async function issueDocumentNumber(
  tx: Prisma.TransactionClient,
  organizationId: number,
  codeType: DocumentCodeType,
  format: CodeFormat,
  fiscalYear: string,
): Promise<string> {
  const issued = await takeSequenceNumber(
    tx,
    organizationId,
    documentSequenceDocType(codeType, fiscalYear),
    format,
  );
  return formatDocumentNumber(format, fiscalYear, issued);
}

export function lineRows(lines: readonly PricedLine[], actorId: number) {
  return lines.map((l) => ({
    lineNo: l.lineNo,
    description: l.description,
    hsnCode: l.hsnCode,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    amount: l.amount,
    createdBy: actorId,
    updatedBy: actorId,
  }));
}

/** Search on the document number, the customer's name/code and
 * prepared-by. */
export function searchWhere(
  search: string | undefined,
  numberField: "quotationNumber" | "invoiceNumber" | "dcNumber",
) {
  if (!search) return {};
  const contains = { contains: search, mode: "insensitive" } as const;
  return {
    OR: [
      { [numberField]: contains },
      { preparedBy: contains },
      { customer: { companyName: contains } },
      { customer: { customerCode: contains } },
    ],
  };
}

/** The audited money/party fields of a quotation or invoice. */
export function pricedSnapshot(row: {
  customerId: number;
  placeOfSupply: string;
  taxMode: string;
  cgstRate: Prisma.Decimal;
  sgstRate: Prisma.Decimal;
  igstRate: Prisma.Decimal;
  taxableAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  lines: ReadonlyArray<unknown>;
}) {
  return {
    customerId: row.customerId,
    placeOfSupply: row.placeOfSupply,
    taxMode: row.taxMode,
    cgstRate: row.cgstRate.toString(),
    sgstRate: row.sgstRate.toString(),
    igstRate: row.igstRate.toString(),
    taxableAmount: row.taxableAmount.toString(),
    totalAmount: row.totalAmount.toString(),
    lines: row.lines.length,
  };
}
