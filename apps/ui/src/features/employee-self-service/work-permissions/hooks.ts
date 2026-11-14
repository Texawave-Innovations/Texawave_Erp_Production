"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  createMyWorkPermission,
  listMyWorkPermissions,
  type CreateWorkPermissionInput,
  type WorkPermissionsResult,
} from "./api";

function key(organizationId: number, year?: number) {
  return orgScopedKey(
    organizationId,
    "self-service-work-permissions",
    "list",
    year ?? "all",
  );
}

export function useMyWorkPermissions(year?: number) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery<WorkPermissionsResult>({
    queryKey: key(organizationId ?? 0, year),
    queryFn: () => listMyWorkPermissions(year),
    enabled: Boolean(organizationId),
  });
}

export function useCreateMyWorkPermission() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return useMutation({
    mutationFn: (input: CreateWorkPermissionInput) =>
      createMyWorkPermission(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(
          organizationId ?? 0,
          "self-service-work-permissions",
        ),
      });
    },
  });
}
