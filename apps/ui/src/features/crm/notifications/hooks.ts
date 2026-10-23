"use client";

import type {
  CrmNotificationTab,
  SnoozeCrmNotificationInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import {
  acknowledgeNotification,
  deleteNotification,
  getNotificationFeed,
  markNotificationDone,
  markNotificationRead,
  permanentlyDeleteNotification,
  refreshNotifications,
  restoreNotification,
  snoozeNotification,
} from "./api";

/** Legacy generator re-scan cadence (`useCrmNotificationGenerator`). */
export const NOTIFICATION_RESCAN_MS = 60_000;

const feedKey = (organizationId: number, tab?: CrmNotificationTab) =>
  tab
    ? orgScopedKey(organizationId, "crm-notifications", tab)
    : orgScopedKey(organizationId, "crm-notifications");

export function useNotificationFeed(tab: CrmNotificationTab, enabled: boolean) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: feedKey(organizationId ?? 0, tab),
    queryFn: () => getNotificationFeed(tab),
    enabled: enabled && Boolean(organizationId),
    refetchInterval: NOTIFICATION_RESCAN_MS,
  });
}

/** Mounted once for CRM pages: asks the server to (idempotently) regenerate
 * notifications from live CRM data on load and every 60 seconds, then
 * refreshes the feed. */
export function useNotificationSync(enabled: boolean) {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  useEffect(() => {
    if (!enabled || !organizationId) return;
    let cancelled = false;
    const run = () => {
      refreshNotifications()
        .then(() => {
          if (!cancelled)
            void queryClient.invalidateQueries({
              queryKey: feedKey(organizationId),
            });
        })
        .catch(() => undefined);
    };
    run();
    const interval = setInterval(run, NOTIFICATION_RESCAN_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled, organizationId, queryClient]);
}

function useInvalidateFeed() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return () =>
    void queryClient.invalidateQueries({
      queryKey: feedKey(organizationId ?? 0),
    });
}

export function useAcknowledgeNotification() {
  const invalidate = useInvalidateFeed();
  return useMutation({
    mutationFn: (id: number) => acknowledgeNotification(id),
    onSuccess: invalidate,
  });
}

export function useMarkNotificationDone() {
  const invalidate = useInvalidateFeed();
  return useMutation({
    mutationFn: (id: number) => markNotificationDone(id),
    onSuccess: invalidate,
  });
}

export function useSnoozeNotification() {
  const invalidate = useInvalidateFeed();
  return useMutation({
    mutationFn: (v: { id: number; input: SnoozeCrmNotificationInput }) =>
      snoozeNotification(v.id, v.input),
    onSuccess: invalidate,
  });
}

export function useMarkNotificationRead() {
  const invalidate = useInvalidateFeed();
  return useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: invalidate,
  });
}

export function useRestoreNotification() {
  const invalidate = useInvalidateFeed();
  return useMutation({
    mutationFn: (id: number) => restoreNotification(id),
    onSuccess: invalidate,
  });
}

export function useDeleteNotification() {
  const invalidate = useInvalidateFeed();
  return useMutation({
    mutationFn: (id: number) => deleteNotification(id),
    onSuccess: invalidate,
  });
}

export function usePermanentlyDeleteNotification() {
  const invalidate = useInvalidateFeed();
  return useMutation({
    mutationFn: (id: number) => permanentlyDeleteNotification(id),
    onSuccess: invalidate,
  });
}
