import type { CustomerSnapshot } from "../shared/documents";

/** Mirrors apps/api/src/modules/sales/documents/returnable-dcs.repository.ts
 * (toView). Quantities arrive as decimal strings. */

export type RdcStatus = "ISSUED" | "RETURNED";

export interface ReturnableDc {
  id: number;
  rdcNumber: string;
  customerId: number;
  customerSnapshot: CustomerSnapshot;
  issueDate: string;
  purpose: string;
  expectedReturnDate: string;
  takenBy: string | null;
  sealName: string | null;
  signatureName: string | null;
  sealItemId: number | null;
  signatureItemId: number | null;
  preparedBy: string | null;
  notes: string | null;
  status: RdcStatus;
  returnedDate: string | null;
  /** Days past the expected return date while still out, else null. */
  overdueDays: number | null;
  itemsCount: number;
  lines: Array<{ lineNo: number; description: string; quantity: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface ReturnableDcBody {
  customerId: number;
  issueDate: string;
  purpose: string;
  expectedReturnDate: string;
  takenBy: string | null;
  lines: Array<{ description: string; quantity: number }>;
  sealItemId: number | null;
  signatureItemId: number | null;
  sealName?: string | null;
  signatureName?: string | null;
  preparedBy: string | null;
  notes?: string | null;
}
