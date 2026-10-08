"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { listFullMonthPresent, type FullMonthPresentQuery } from "./api";

const KEY = "hr-full-month-present" as const;

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

export function useFullMonthPresentList(query: FullMonthPresentQuery) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "list", query),
    queryFn: () => listFullMonthPresent(query),
    enabled: orgId > 0,
  });
}
