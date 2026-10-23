"use client";

import type {
  QueryCrmOverallDataInput,
  QueryCrmOverallDataRecordsInput,
} from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { getOverallDataMonth, getOverallDataRecords } from "./api";

export function useOverallDataMonth(query: QueryCrmOverallDataInput) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "crm-overall-data", query),
    queryFn: () => getOverallDataMonth(query),
    enabled: Boolean(organizationId),
    placeholderData: keepPreviousData,
  });
}

export function useOverallDataRecords(
  query: QueryCrmOverallDataRecordsInput | null,
) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "crm-overall-data",
      "records",
      query ?? {},
    ),
    queryFn: () =>
      getOverallDataRecords(query as QueryCrmOverallDataRecordsInput),
    enabled: Boolean(organizationId) && query !== null,
    placeholderData: keepPreviousData,
  });
}

/** Refresh the grid + drill-down after a record is deleted via its owning
 * entity's own delete endpoint. */
export function useInvalidateOverallData() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((s) => s.organizationId);
  return () =>
    void queryClient.invalidateQueries({
      queryKey: orgScopedKey(organizationId ?? 0, "crm-overall-data"),
    });
}
