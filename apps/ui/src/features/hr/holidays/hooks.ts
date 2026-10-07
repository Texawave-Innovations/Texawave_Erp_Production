"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  createHoliday,
  listHolidays,
  listWorkLocations,
  setHolidayActive,
  updateHoliday,
  type CreateHolidayBody,
  type HolidayListQuery,
  type UpdateHolidayBody,
} from "./api";

const KEY = "hr-holidays" as const;

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

export function useHolidays(query: HolidayListQuery) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "list", query),
    queryFn: () => listHolidays(query),
    enabled: orgId > 0,
  });
}

export function useWorkLocations(enabled: boolean) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, "hr-lookup", "/master-data/work-locations"),
    queryFn: () => listWorkLocations(),
    enabled: enabled && orgId > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateHoliday() {
  return useOrgScopedMutation([KEY], (body: CreateHolidayBody) =>
    createHoliday(body),
  );
}

export function useUpdateHoliday() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number; body: UpdateHolidayBody }) =>
      updateHoliday(id, body),
  );
}

export function useSetHolidayActive() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, isActive }: { id: number; isActive: boolean }) =>
      setHolidayActive(id, isActive),
  );
}
