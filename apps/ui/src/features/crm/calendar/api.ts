import type {
  CrmCalendarEventDetail,
  CrmCalendarEventsResponse,
  CrmCalendarItemType,
  QueryCrmCalendarEventsInput,
} from "@texawave-erp/api-types";
import { apiClient, withAuthRetry } from "@/lib/api-client";

/** Thin wrappers around the shared `apiClient` — routes confirmed from
 * apps/api/src/modules/crm/calendar/calendar.controller.ts. */
export async function listCalendarEvents(
  query: QueryCrmCalendarEventsInput,
): Promise<CrmCalendarEventsResponse> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<CrmCalendarEventsResponse>("/crm/calendar/events", {
      query,
    }),
  );
  return data;
}

export async function getCalendarEvent(
  type: CrmCalendarItemType,
  id: number,
): Promise<CrmCalendarEventDetail> {
  const { data } = await withAuthRetry(() =>
    apiClient.get<CrmCalendarEventDetail>(`/crm/calendar/events/${type}/${id}`),
  );
  return data;
}
