import type {
  CreateProductInput,
  PaginatedEnvelope,
  Product,
  QueryProductsInput,
  UpdateProductInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Thin wrappers around the shared `apiClient` — mirrors
 * apps/ui/src/features/crm/leads/api.ts. Migrated from the LIVE legacy
 * TexaWave_ERP/src/modules/crm/Products.tsx +
 * domain/productsService.ts. */
export function listProducts(
  query: QueryProductsInput,
): Promise<PaginatedEnvelope<Product>> {
  return withAuthRetry(() =>
    apiClient.get<Product[]>("/crm/products", { query }),
  ) as Promise<PaginatedEnvelope<Product>>;
}

export async function getProduct(id: number): Promise<Product> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<Product>(`/crm/products/${id}`),
  );
  return data;
}

export async function createProduct(
  input: CreateProductInput,
): Promise<Product> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Product>("/crm/products", input),
  );
  return data;
}

export async function updateProduct(
  id: number,
  input: UpdateProductInput,
): Promise<Product> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<Product>(`/crm/products/${id}`, input),
  );
  return data;
}

export async function deleteProduct(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`/crm/products/${id}`));
}
