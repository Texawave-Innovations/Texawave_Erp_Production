import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Thin typed wrappers over `apiClient` shared by every SCM feature, so each
 * feature's `api.ts` is only its endpoint paths. */
export function scmList<T>(
  path: string,
  query: object = {},
): Promise<PaginatedEnvelope<T>> {
  return withAuthRetry(() => apiClient.get<T[]>(path, { query })) as Promise<
    PaginatedEnvelope<T>
  >;
}

export async function scmGet<T>(path: string, query?: object): Promise<T> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<T>(path, query ? { query } : undefined),
  );
  return data;
}

export async function scmPost<T>(path: string, body?: object): Promise<T> {
  const { data } = await withAuthRetry(() => apiClient.post<T>(path, body));
  return data;
}

export async function scmPatch<T>(path: string, body?: object): Promise<T> {
  const { data } = await withAuthRetry(() => apiClient.patch<T>(path, body));
  return data;
}

export async function scmPut<T>(path: string, body?: object): Promise<T> {
  const { data } = await withAuthRetry(() => apiClient.put<T>(path, body));
  return data;
}

export async function scmDelete(path: string): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(path));
}
