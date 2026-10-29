import type { CustomerSnapshot } from "../shared/documents";

/** Mirrors apps/api/src/modules/sales/documents/delivery-challans.repository.ts
 * (toView). Quantities arrive as decimal strings. */

export type DcStatus = "DRAFT" | "DISPATCHED";

export interface DeliveryChallan {
  id: number;
  dcNumber: string;
  customerId: number;
  customerSnapshot: CustomerSnapshot;
  dcDate: string;
  sourceInvoiceId: number | null;
  sourceInvoice: { id: number; invoiceNumber: string } | null;
  sealName: string | null;
  signatureName: string | null;
  sealItemId: number | null;
  signatureItemId: number | null;
  preparedBy: string | null;
  notes: string | null;
  status: DcStatus;
  itemsCount: number;
  lines: Array<{
    lineNo: number;
    description: string;
    hsnCode: string | null;
    quantity: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryChallanBody {
  customerId: number;
  dcDate: string;
  status: DcStatus;
  lines: Array<{
    description: string;
    hsnCode: string | null;
    quantity: number;
  }>;
  sealItemId: number | null;
  signatureItemId: number | null;
  sealName?: string | null;
  signatureName?: string | null;
  preparedBy: string | null;
  notes: string | null;
}
