import type {
  CreateTagInput,
  PaginatedEnvelope,
  QueryTagsInput,
  Tag,
  UpdateTagInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/**
 * FIXTURE reference feature — mirrors apps/api/src/modules/_reference/tags/.
 * Every feature's `api.ts` looks like this: thin wrappers around the shared
 * `apiClient`, never `fetch` called directly from a component or hook
 * (Docs/CODING_STANDARDS.md "Frontend API/state/error standard").
 */
export function listTags(
  query: QueryTagsInput,
): Promise<PaginatedEnvelope<Tag>> {
  return withAuthRetry(() =>
    apiClient.get<Tag[]>("/reference/tags", { query }),
  ) as Promise<PaginatedEnvelope<Tag>>;
}

export async function getTag(id: number): Promise<Tag> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<Tag>(`/reference/tags/${id}`),
  );
  return data;
}

export async function createTag(input: CreateTagInput): Promise<Tag> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<Tag>("/reference/tags", input),
  );
  return data;
}

export async function updateTag(
  id: number,
  input: UpdateTagInput,
): Promise<Tag> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<Tag>(`/reference/tags/${id}`, input),
  );
  return data;
}

export async function deleteTag(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`/reference/tags/${id}`));
}
