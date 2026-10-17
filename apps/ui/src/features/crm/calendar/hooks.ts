"use client";

import type {
  CrmCalendarItemType,
  QueryCrmCalendarEventsInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { getCalendarEvent, listCalendarEvents } from "./api";

export function useCalendarEvents(query: QueryCrmCalendarEventsInput) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "crm-calendar-events", query),
    queryFn: () => listCalendarEvents(query),
    enabled: Boolean(organizationId),
    placeholderData: keepPreviousData,
  });
}

export function useCalendarEvent(
  type: CrmCalendarItemType | undefined,
  id: number | undefined,
) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "crm-calendar-event", {
      type,
      id,
    }),
    queryFn: () => getCalendarEvent(type as CrmCalendarItemType, id as number),
    enabled: Boolean(organizationId) && Boolean(type) && id !== undefined,
  });
}
