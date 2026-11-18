import type { PaginatedEnvelope } from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import type { AppNotification, DndRequest, DndState } from "./types";

const BASE = "/notifications";

/** The caller's own inbox. No permission code: every route is keyed to the
 * JWT user, so there is nothing to grant (Docs/HR_API.md → Notifications). */
export function listNotifications(query: {
  page: number;
  limit: number;
  unreadOnly?: boolean;
}): Promise<PaginatedEnvelope<AppNotification>> {
  return withAuthRetry(() =>
    apiClient.get<AppNotification[]>(BASE, { query }),
  ) as Promise<PaginatedEnvelope<AppNotification>>;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<{ unread: number }>(`${BASE}/unread-count`),
  );
  return data.unread;
}

/** Do Not Disturb: quiets the bell badge only; notifications are still stored. */
export async function getDnd(): Promise<DndState> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<DndState>(`${BASE}/dnd`),
  );
  return data;
}

export async function setDnd(body: DndRequest): Promise<DndState> {
  const { data } = await withAuthRetry(() =>
    apiClient.put<DndState>(`${BASE}/dnd`, body),
  );
  return data;
}

export async function markNotificationRead(
  id: number,
): Promise<AppNotification> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<AppNotification>(`${BASE}/${id}/read`, {}),
  );
  return data;
}

export async function markAllNotificationsRead(): Promise<number> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<{ marked: number }>(`${BASE}/read-all`, {}),
  );
  return data.marked;
}
