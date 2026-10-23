"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./api";

const KEY = "notifications" as const;
/** Alerts are produced by a 5-minute server job, so polling every minute
 * shows them promptly without load. Polling stops while the tab is hidden. */
const POLL_MS = 60_000;

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

export function useUnreadNotificationCount() {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "unread"),
    queryFn: getUnreadCount,
    enabled: orgId > 0,
    refetchInterval: POLL_MS,
  });
}

export function useNotifications(enabled: boolean) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "list"),
    queryFn: () => listNotifications({ page: 1, limit: 40 }),
    enabled: orgId > 0 && enabled,
  });
}

export function useMarkNotificationRead() {
  return useOrgScopedMutation([KEY], (id: number) => markNotificationRead(id));
}

export function useMarkAllNotificationsRead() {
  return useOrgScopedMutation([KEY], () => markAllNotificationsRead());
}
