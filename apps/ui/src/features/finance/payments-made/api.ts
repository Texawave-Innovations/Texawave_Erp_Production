import type {
  CreateFinancePaymentMadeInput,
  FinanceBankAccount,
  FinancePaymentMade,
  PaginatedEnvelope,
  QueryFinancePaymentsMadeInput,
  UpdateFinancePaymentMadeInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Fetch paginated list of vendor disbursements with optional filters. */
export function listPaymentsMade(
  query: QueryFinancePaymentsMadeInput = {},
): Promise<PaginatedEnvelope<FinancePaymentMade>> {
  return withAuthRetry(() =>
    apiClient.get<FinancePaymentMade[]>("/finance/payments-made", {
      query,
    }),
  ) as Promise<PaginatedEnvelope<FinancePaymentMade>>;
}

/** Fetch a single supplier disbursement by ID including bank account and GL voucher. */
export async function getPaymentMade(id: number): Promise<FinancePaymentMade> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<FinancePaymentMade>(`/finance/payments-made/${id}`),
  );
  return data;
}

/** Record supplier disbursement (CONFIRMED automatically creates and posts GL journal and deducts bank balance). */
export async function createPaymentMade(
  input: CreateFinancePaymentMadeInput,
): Promise<FinancePaymentMade> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinancePaymentMade>("/finance/payments-made", input),
  );
  return data;
}

/** Update supplier disbursement metadata (vendorName, referenceNumber, billReference, notes on DRAFT only). */
export async function updatePaymentMade(
  id: number,
  input: UpdateFinancePaymentMadeInput,
): Promise<FinancePaymentMade> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<FinancePaymentMade>(`/finance/payments-made/${id}`, input),
  );
  return data;
}

/** Confirm a draft disbursement and atomically post double-entry GL journal + deduct bank balance. */
export async function confirmPaymentMade(
  id: number,
): Promise<FinancePaymentMade> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinancePaymentMade>(`/finance/payments-made/${id}/confirm`),
  );
  return data;
}

/** Void a disbursement (atomically creates GL reversal voucher and refunds bank balance). */
export async function voidPaymentMade(id: number): Promise<FinancePaymentMade> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinancePaymentMade>(`/finance/payments-made/${id}/void`),
  );
  return data;
}

/** Soft delete a DRAFT or VOID supplier disbursement. */
export async function deletePaymentMade(id: number): Promise<void> {
  await withAuthRetry(() =>
    apiClient.delete<void>(`/finance/payments-made/${id}`),
  );
}

/** Fetch active company bank accounts for source disbursement funds. */
export async function listActiveBankAccounts(): Promise<FinanceBankAccount[]> {
  const res = (await withAuthRetry(() =>
    apiClient.get<FinanceBankAccount[]>("/finance/bank-accounts", {
      query: { limit: 100, isActive: true },
    }),
  )) as unknown as PaginatedEnvelope<FinanceBankAccount>;
  return res?.data ?? [];
}
