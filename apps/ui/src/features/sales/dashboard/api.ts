import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type { ActionItem, SalesDashboard } from "./types";

export async function getSalesDashboard(): Promise<SalesDashboard> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<SalesDashboard>("/sales/dashboard"),
  );
  return data;
}

const ITEMS = "/sales/action-items";

export function listActionItems(query: {
  page: number;
  limit: number;
  state: "open" | "done" | "all";
}): Promise<PaginatedEnvelope<ActionItem>> {
  return withAuthRetry(() =>
    apiClient.get<ActionItem[]>(ITEMS, { query }),
  ) as Promise<PaginatedEnvelope<ActionItem>>;
}

export async function createActionItem(body: {
  title: string;
  dueDate?: string;
}): Promise<ActionItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ActionItem>(ITEMS, body),
  );
  return data;
}

export async function setActionItemDone(
  id: number,
  done: boolean,
): Promise<ActionItem> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<ActionItem>(
      `${ITEMS}/${id}/${done ? "complete" : "reopen"}`,
    ),
  );
  return data;
}

export async function deleteActionItem(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete(`${ITEMS}/${id}`));
}
