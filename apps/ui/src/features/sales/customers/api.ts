import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type { Customer, CustomerBody, CustomerStatus } from "./types";

const BASE = "/sales/customers";

export interface CustomerListQuery {
  page: number;
  limit: number;
  search?: string;
  status?: CustomerStatus;
}

export function listCustomers(
  query: CustomerListQuery,
): Promise<PaginatedEnvelope<Customer>> {
  return withAuthRetry(() =>
    apiClient.get<Customer[]>(BASE, { query }),
  ) as Promise<PaginatedEnvelope<Customer>>;
}

export async function getCustomer(id: number): Promise<Customer> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<Customer>(`${BASE}/${id}`),
  );
  return data;
}

/** Preview of the code a new customer would get (not reserved). */
export async function getNextCustomerCode(
  mobileCountryCode: string,
): Promise<string> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<{ customerCode: string }>(`${BASE}/next-code`, {
      query: { mobileCountryCode },
    }),
  );
  return data.customerCode;
}

export async function createCustomer(body: CustomerBody): Promise<Customer> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Customer>(BASE, body),
  );
  return data;
}

export async function updateCustomer(
  id: number,
  body: Partial<CustomerBody>,
): Promise<Customer> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<Customer>(`${BASE}/${id}`, body),
  );
  return data;
}

export async function deleteCustomer(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete(`${BASE}/${id}`));
}

/** The full account number — audited on the server. */
export async function revealBankAccount(id: number): Promise<string | null> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<{ bankAccountNumber: string | null }>(
      `${BASE}/${id}/bank-account`,
    ),
  );
  return data.bankAccountNumber;
}
