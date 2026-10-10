"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  createMyWorkLog,
  listMyWorkLogs,
  type CreateWorkLogInput,
} from "./api";

export function useMyWorkLogs() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "self-service-work-logs",
      "list",
    ),
    queryFn: listMyWorkLogs,
    enabled: Boolean(organizationId),
  });
}

export function useCreateMyWorkLog() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: (input: CreateWorkLogInput) => createMyWorkLog(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(
          organizationId ?? 0,
          "self-service-work-logs",
          "list",
        ),
      });
    },
  });
}
