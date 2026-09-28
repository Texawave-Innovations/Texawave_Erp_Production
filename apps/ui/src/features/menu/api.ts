import type {
  CreateMenuItemInput,
  MenuItem,
  MenuTreeNode,
  QueryMenuItemsInput,
  UpdateMenuItemInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

export async function getMyMenu(): Promise<MenuTreeNode[]> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<MenuTreeNode[]>("/menu/my-menu"),
  );
  return data;
}

export async function listMenuItems(
  query: QueryMenuItemsInput = {},
): Promise<{ items: MenuItem[]; total: number }> {
  const { data, meta } = await withAuthRetry(() =>
    apiClient.get<MenuItem[]>("/menu/items", { query }),
  );
  return { items: data, total: meta?.total ?? data.length };
}

export async function getMenuItem(id: number): Promise<MenuItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<MenuItem>(`/menu/items/${id}`),
  );
  return data;
}

export async function createMenuItem(
  input: CreateMenuItemInput,
): Promise<MenuItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<MenuItem>("/menu/items", input),
  );
  return data;
}

export async function updateMenuItem(
  id: number,
  input: UpdateMenuItemInput,
): Promise<MenuItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.patch<MenuItem>(`/menu/items/${id}`, input),
  );
  return data;
}

export async function deleteMenuItem(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete(`/menu/items/${id}`));
}
