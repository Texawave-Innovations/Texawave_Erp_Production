"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { searchCrm } from "./api";

export function useCrmSearch(q: string) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "crm-search", { q }),
    queryFn: () => searchCrm(q),
    enabled: Boolean(organizationId) && q.length > 0,
  });
}
