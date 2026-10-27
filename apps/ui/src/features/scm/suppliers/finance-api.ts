import type {
  CreateSupplierBillInput,
  CreateSupplierPaymentInput,
  PaginatedEnvelope,
  PostSupplierBillToFinanceInput,
  QuerySupplierBillsInput,
  QuerySupplierPaymentsInput,
  SupplierBill,
  SupplierDocument,
  SupplierDocumentType,
  SupplierFinanceSummary,
  SupplierPayment,
  UpdateSupplierBillInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import {
  scmDelete,
  scmGet,
  scmList,
  scmPatch,
  scmPost,
} from "../shared/scm-api";

/** Supplier finance endpoints (Accounts Payable bills, payments made, and
 * supplier documents) — apps/api/src/modules/scm/finance. */

export const listSupplierBills = (
  query: QuerySupplierBillsInput,
): Promise<PaginatedEnvelope<SupplierBill>> =>
  scmList<SupplierBill>("/scm/finance/bills", query);

export const createSupplierBill = (input: CreateSupplierBillInput) =>
  scmPost<SupplierBill>("/scm/finance/bills", input);

export const updateSupplierBill = (
  id: number,
  input: UpdateSupplierBillInput,
) => scmPatch<SupplierBill>(`/scm/finance/bills/${id}`, input);

export const cancelSupplierBill = (id: number, reason: string) =>
  scmPost<SupplierBill>(`/scm/finance/bills/${id}/cancel`, { reason });

export interface PostSupplierBillToFinanceResult {
  success: boolean;
  alreadyPosted?: boolean;
  documentReference: string;
  journalEntryId: number;
  journalEntryNumber?: string;
  gstEntryId: number | null;
  message: string;
}

export const postSupplierBillToFinance = (
  id: number,
  input?: PostSupplierBillToFinanceInput,
) =>
  scmPost<PostSupplierBillToFinanceResult>(
    `/scm/finance/bills/${id}/post-to-finance`,
    input ?? {},
  );

export const listSupplierPayments = (
  query: QuerySupplierPaymentsInput,
): Promise<PaginatedEnvelope<SupplierPayment>> =>
  scmList<SupplierPayment>("/scm/finance/payments", query);

export const createSupplierPayment = (input: CreateSupplierPaymentInput) =>
  scmPost<SupplierPayment>("/scm/finance/payments", input);

export const voidSupplierPayment = (id: number, reason: string) =>
  scmPost<SupplierPayment>(`/scm/finance/payments/${id}/void`, { reason });

export const getSupplierFinanceSummary = (supplierId: number) =>
  scmGet<SupplierFinanceSummary>(
    `/scm/finance/suppliers/${supplierId}/summary`,
  );

// ---- documents --------------------------------------------------------------

const docBase = (supplierId: number) =>
  `/scm/suppliers/${supplierId}/documents`;

export const listSupplierDocuments = (supplierId: number) =>
  scmGet<SupplierDocument[]>(docBase(supplierId));

/** Multipart upload: `file` plus optional `name` / `documentType`. */
export function uploadSupplierDocument(
  supplierId: number,
  input: { file: File; name?: string; documentType?: SupplierDocumentType },
): Promise<SupplierDocument> {
  const formData = new FormData();
  formData.append("file", input.file);
  if (input.name?.trim()) formData.append("name", input.name.trim());
  if (input.documentType) formData.append("documentType", input.documentType);
  return withAuthRetry(() =>
    apiClient.request<SupplierDocument>(docBase(supplierId), {
      method: "POST",
      formData,
    }),
  ).then((res) => res.data);
}

export const removeSupplierDocument = (supplierId: number, id: number) =>
  scmDelete(`${docBase(supplierId)}/${id}`);

/** apiClient only parses JSON, so the binary goes through fetch with the same
 * bearer token. `open` shows it in a new tab (PDF / image); otherwise it is
 * saved with its own file name. */
export async function fetchSupplierDocument(
  supplierId: number,
  id: number,
  fileName: string,
  mode: "open" | "save",
): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${baseUrl}${docBase(supplierId)}/${id}/file`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Download failed with status ${res.status}`);
  const url = URL.createObjectURL(await res.blob());
  if (mode === "open") {
    window.open(url, "_blank", "noopener");
  } else {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  // Give the new tab time to read the blob before it is released.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
