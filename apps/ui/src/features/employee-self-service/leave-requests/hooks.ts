"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  cancelMyLeaveRequest,
  createMyLeaveRequest,
  listLeaveTypes,
  listMyLeaveRequests,
  type CreateLeaveRequestInput,
} from "./api";

function useOrgQuery<T>(name: string, fn: () => Promise<T>) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "self-service-leave", name),
    queryFn: fn,
    enabled: Boolean(organizationId),
  });
}

export const useMyLeaveRequests = () =>
  useOrgQuery("list", listMyLeaveRequests);
export const useLeaveTypes = () => useOrgQuery("types", listLeaveTypes);

export function useCreateMyLeaveRequest() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: (input: CreateLeaveRequestInput) => createMyLeaveRequest(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(
          organizationId ?? 0,
          "self-service-leave",
          "list",
        ),
      });
    },
  });
}

export function useCancelMyLeaveRequest() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: (id: number) => cancelMyLeaveRequest(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(
          organizationId ?? 0,
          "self-service-leave",
          "list",
        ),
      });
    },
  });
}
