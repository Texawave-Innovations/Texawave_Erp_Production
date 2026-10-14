"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  createMyExitRequest,
  listMyExitRequests,
  type CreateExitRequestInput,
} from "./api";

function key(organizationId: number) {
  return orgScopedKey(organizationId, "self-service-exit-requests", "list");
}

export function useMyExitRequests() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: key(organizationId ?? 0),
    queryFn: listMyExitRequests,
    enabled: Boolean(organizationId),
  });
}

export function useCreateMyExitRequest() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: (input: CreateExitRequestInput) => createMyExitRequest(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: key(organizationId ?? 0),
      });
    },
  });
}
