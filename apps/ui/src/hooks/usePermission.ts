"use client";

import { useQuery } from "@tanstack/react-query";
import type { MeUser } from "@texawave-erp/api-types";
import { hasPermission, orgScopedKey } from "@texawave-erp/core";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";

export function useMe() {
  const organizationId = useAuthStore((s) => s.organizationId);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const setPermissions = useAuthStore((s) => s.setPermissions);

  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "auth", "me"),
    queryFn: async () => {
      const res = await apiClient.get<MeUser>("/auth/me");
      setUser({
        userId: res.data.userId,
        organizationId: res.data.organizationId,
        email: res.data.email,
        fullName: res.data.fullName,
        roleIds: res.data.roleIds,
      });
      setPermissions(res.data.permissions);
      return res.data;
    },
    enabled: Boolean(accessToken && organizationId),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Checks whether the current user has the specified permission(s).
 */
export function usePermission(
  required: string | readonly string[],
  mode: "atLeastOne" | "all" = "atLeastOne",
): boolean {
  const permissions = useAuthStore((s) => s.permissions);
  return hasPermission(permissions, required, mode);
}
