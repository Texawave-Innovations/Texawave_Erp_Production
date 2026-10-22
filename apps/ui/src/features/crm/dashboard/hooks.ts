"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { getCrmDashboard } from "./api";

export function useCrmDashboard() {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "crm-dashboard"),
    queryFn: getCrmDashboard,
    enabled: Boolean(organizationId),
    staleTime: 60 * 1000,
  });
}
