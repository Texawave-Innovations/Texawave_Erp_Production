import type {
  CreateFinancePaymentReceivedInput,
  CreatePaymentAllocationInput,
  FinanceBankAccount,
  FinancePaymentReceived,
  PaginatedEnvelope,
  QueryFinancePaymentsReceivedInput,
  UpdateFinancePaymentReceivedInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Fetch paginated list of customer payments received with optional filters. */
export function listPaymentsReceived(
  query: QueryFinancePaymentsReceivedInput = {},
): Promise<PaginatedEnvelope<FinancePaymentReceived>> {
  return withAuthRetry(() =>
    apiClient.get<FinancePaymentReceived[]>("/finance/payments-received", {
      query,
    }),
  ) as Promise<PaginatedEnvelope<FinancePaymentReceived>>;
}

/** Fetch a single customer payment received by ID with allocations and linked GL voucher. */
export async function getPaymentReceived(
  id: number,
): Promise<FinancePaymentReceived> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<FinancePaymentReceived>(`/finance/payments-received/${id}`),
  );
  return data;
}

/** Record customer payment received (CONFIRMED automatically creates and posts GL journal). */
export async function createPaymentReceived(
  input: CreateFinancePaymentReceivedInput,
): Promise<FinancePaymentReceived> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinancePaymentReceived>("/finance/payments-received", input),
  );
  return data;
}

/** Update customer receipt metadata (referenceNumber, notes, customerName). */
export async function updatePaymentReceived(
  id: number,
  input: UpdateFinancePaymentReceivedInput,
): Promise<FinancePaymentReceived> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<FinancePaymentReceived>(
      `/finance/payments-received/${id}`,
      input,
    ),
  );
  return data;
}

/** Confirm a draft receipt and atomically post double-entry GL journal. */
export async function confirmPaymentReceived(
  id: number,
): Promise<FinancePaymentReceived> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinancePaymentReceived>(
      `/finance/payments-received/${id}/confirm`,
    ),
  );
  return data;
}

/** Void a receipt (atomically creates GL reversal voucher and inverts ledger balances). */
export async function voidPaymentReceived(
  id: number,
): Promise<FinancePaymentReceived> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinancePaymentReceived>(
      `/finance/payments-received/${id}/void`,
    ),
  );
  return data;
}

/** Allocate a portion of unallocated receipt balance to an invoice reference. */
export async function addPaymentAllocation(
  id: number,
  input: CreatePaymentAllocationInput,
): Promise<FinancePaymentReceived> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<FinancePaymentReceived>(
      `/finance/payments-received/${id}/allocations`,
      input,
    ),
  );
  return data;
}

/** Remove an invoice allocation and restore unallocated receipt balance. */
export async function removePaymentAllocation(
  id: number,
  allocationId: number,
): Promise<void> {
  await withAuthRetry(() =>
    apiClient.delete<void>(
      `/finance/payments-received/${id}/allocations/${allocationId}`,
    ),
  );
}

/** Delete a draft or void customer payment receipt. */
export async function deletePaymentReceived(id: number): Promise<void> {
  await withAuthRetry(() =>
    apiClient.delete<void>(`/finance/payments-received/${id}`),
  );
}

/** Fetch active company bank accounts for payment receipt deposit. */
export async function listActiveBankAccounts(): Promise<FinanceBankAccount[]> {
  const res = (await withAuthRetry(() =>
    apiClient.get<FinanceBankAccount[]>("/finance/bank-accounts", {
      query: { limit: 100, isActive: true },
    }),
  )) as unknown as PaginatedEnvelope<FinanceBankAccount>;
  return res?.data ?? [];
}
