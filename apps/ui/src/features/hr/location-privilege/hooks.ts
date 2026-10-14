"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  addOfficeNetwork,
  getEmployeeLocationPrivilege,
  listOfficeNetworks,
  setEmployeeLocationPrivilege,
  setOfficeNetworkActive,
} from "./api";
import type { LocationMode } from "./types";

const KEY = "hr-location-privilege" as const;
const NETWORK_KEY = "hr-office-networks" as const;

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

export function useEmployeeLocationPrivilege(employeeId: number) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "detail", employeeId),
    queryFn: () => getEmployeeLocationPrivilege(employeeId),
    enabled: orgId > 0 && Number.isInteger(employeeId) && employeeId > 0,
    retry: false,
  });
}

export function useSetEmployeeLocationPrivilege() {
  return useOrgScopedMutation(
    [KEY],
    ({ employeeId, mode }: { employeeId: number; mode: LocationMode }) =>
      setEmployeeLocationPrivilege(employeeId, mode),
  );
}

export function useOfficeNetworks(enabled: boolean) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, NETWORK_KEY, "list"),
    queryFn: () => listOfficeNetworks(),
    enabled: enabled && orgId > 0,
  });
}

export function useAddOfficeNetwork() {
  return useOrgScopedMutation(
    [NETWORK_KEY],
    (body: { ipAddress: string; label?: string }) => addOfficeNetwork(body),
  );
}

export function useSetOfficeNetworkActive() {
  return useOrgScopedMutation(
    [NETWORK_KEY],
    ({ id, isActive }: { id: number; isActive: boolean }) =>
      setOfficeNetworkActive(id, isActive),
  );
}
