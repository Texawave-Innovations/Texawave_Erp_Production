import type {
  CreateSupplierInput,
  PaginatedEnvelope,
  QuerySuppliersInput,
  Supplier,
  SupplierActivityEntry,
  UpdateSupplierInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Thin wrappers around the shared `apiClient`. Migrated from the LEGACY
 * TexaWave_ERP_old/src/modules/scm/suppliers (Firebase direct reads) to the
 * NestJS `scm/suppliers` endpoints. */
export function listSuppliers(
  query: QuerySuppliersInput,
): Promise<PaginatedEnvelope<Supplier>> {
  return withAuthRetry(() =>
    apiClient.get<Supplier[]>("/scm/suppliers", { query }),
  ) as Promise<PaginatedEnvelope<Supplier>>;
}

export async function getSupplier(id: number): Promise<Supplier> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<Supplier>(`/scm/suppliers/${id}`),
  );
  return data;
}

export async function listSupplierTypes(): Promise<string[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<string[]>("/scm/suppliers/types"),
  );
  return data;
}

export async function getNextSupplierCode(): Promise<string> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<{ supplierCode: string }>("/scm/suppliers/next-code"),
  );
  return data.supplierCode;
}

export async function listSupplierActivity(
  id: number,
): Promise<SupplierActivityEntry[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<SupplierActivityEntry[]>(`/scm/suppliers/${id}/activity`),
  );
  return data;
}

export async function createSupplier(
  input: CreateSupplierInput,
): Promise<Supplier> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Supplier>("/scm/suppliers", input),
  );
  return data;
}

export async function updateSupplier(
  id: number,
  input: UpdateSupplierInput,
): Promise<Supplier> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<Supplier>(`/scm/suppliers/${id}`, input),
  );
  return data;
}
