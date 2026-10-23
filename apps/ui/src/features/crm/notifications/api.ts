import type {
  CrmNotification,
  CrmNotificationFeed,
  CrmNotificationRefreshResult,
  CrmNotificationTab,
  SnoozeCrmNotificationInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Routes confirmed from
 * apps/api/src/modules/crm/crm-notifications/crm-notifications.controller.ts. */
export async function getNotificationFeed(
  tab: CrmNotificationTab,
): Promise<CrmNotificationFeed> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<CrmNotificationFeed>("/crm/notifications", {
      query: { tab },
    }),
  );
  return data;
}

export async function refreshNotifications(): Promise<CrmNotificationRefreshResult> {
  const { data } = await withAuthRetry(() =>
    apiClient.post<CrmNotificationRefreshResult>("/crm/notifications/refresh"),
  );
  return data;
}

function action(id: number, name: string, body?: unknown) {
  return withAuthRetry(() =>
    apiClient.post<CrmNotification>(`/crm/notifications/${id}/${name}`, body),
  );
}

export const acknowledgeNotification = (id: number) =>
  action(id, "acknowledge");
export const markNotificationDone = (id: number) => action(id, "done");
export const markNotificationRead = (id: number) => action(id, "read");
export const restoreNotification = (id: number) => action(id, "restore");
export const snoozeNotification = (
  id: number,
  input: SnoozeCrmNotificationInput,
) => action(id, "snooze", input);

export async function deleteNotification(id: number): Promise<void> {
  await withAuthRetry(() => apiClient.delete<void>(`/crm/notifications/${id}`));
}

export async function permanentlyDeleteNotification(id: number): Promise<void> {
  await withAuthRetry(() =>
    apiClient.delete<void>(`/crm/notifications/${id}/permanent`),
  );
}
