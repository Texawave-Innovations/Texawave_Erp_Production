import { Injectable } from "@nestjs/common";
import type { Prisma } from "@texawave-erp/database";

/** Document prefixes, ported from legacy `DEFAULT_PREFIXES`. */
export const SCM_PREFIXES = {
  stockTransfer: "TW/STK-TRF",
  stockAdjustment: "TW/STK-ADJ",
  purchaseRequisition: "TW/PR",
  rfq: "TW/RFQ",
  supplierQuotation: "TW/SQ",
  purchaseOrder: "TW/PO",
  grn: "TW/GRN",
  putaway: "TW/PUTAWAY",
  warehouseMovement: "TW/WHMOV",
  pick: "TW/PICK",
  pack: "TW/PACK",
  salesOrder: "TW/SO",
  fulfillment: "TW/FUL",
  shipment: "TW/SHIP",
  customerReturn: "TW/CR",
  vendorReturn: "TW/VR",
  qualityInspection: "TW/QC",
  supplierBill: "TW/BILL",
  supplierPayment: "TW/PAY",
  taxInvoice: "TW/INV",
} as const;
export type ScmPrefixKey = keyof typeof SCM_PREFIXES;

/** Indian financial year (April-March) as `26-27`, same as legacy
 * `getFinancialYearString`. */
export function financialYearString(date: Date = new Date()): string {
  const month = date.getMonth();
  const year = date.getFullYear();
  const start = month < 3 ? year - 1 : year;
  const end = start + 1;
  return `${String(start).slice(-2)}-${String(end).slice(-2)}`;
}

/** Per-prefix, per-financial-year sequence (`TW/PR/26-27/0001`). The counter
 * is an atomic upsert-increment inside the caller's transaction, so two
 * concurrent documents can never receive the same number and a rolled-back
 * document does not burn a number. */
@Injectable()
export class ScmNumberingService {
  async next(
    tx: Prisma.TransactionClient,
    organizationId: number,
    key: ScmPrefixKey,
    date: Date = new Date(),
  ): Promise<string> {
    const prefix = SCM_PREFIXES[key];
    const fiscalYear = financialYearString(date);
    const row = await tx.scmNumberSequence.upsert({
      where: {
        organizationId_prefix_fiscalYear: {
          organizationId,
          prefix,
          fiscalYear,
        },
      },
      create: { organizationId, prefix, fiscalYear, lastValue: 1 },
      update: { lastValue: { increment: 1 } },
    });
    return `${prefix}/${fiscalYear}/${String(row.lastValue).padStart(4, "0")}`;
  }
}
