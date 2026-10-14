"use client";

import { useQuery } from "@tanstack/react-query";
import { orgScopedKey } from "@texawave-erp/core";
import { useAuthStore } from "@/stores/auth-store";
import { getOrgChart, type OrgChartQuery } from "./api";

const KEY = "hr-org-chart" as const;

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

/** The API already returns the full reporting forest (depth defaults to the
 * max of 10 levels), so one fetch covers expand/collapse entirely
 * client-side — no per-node "load more" round trip needed. */
export function useOrgChart(query: OrgChartQuery = {}) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, query),
    queryFn: () => getOrgChart(query),
    enabled: orgId > 0,
  });
}
