"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { orgScopedKey } from "@texawave-erp/core";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  changeEmployeeStatus,
  createEmployee,
  getEmployee,
  linkEmployeeUser,
  listEmployees,
  listLookup,
  listStatusHistory,
  unlinkEmployeeUser,
  updateEmployee,
  type EmployeeListQuery,
  type LinkAccountBody,
  type StatusChangeBody,
  type UnlinkAccountBody,
} from "./api";

const KEY = "hr-employees" as const;

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

/** Debounces free-text search so each keystroke does not hit the API. */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function useEmployees(query: EmployeeListQuery) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "list", query),
    queryFn: () => listEmployees(query),
    enabled: orgId > 0,
  });
}

export function useEmployee(id: number) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "detail", id),
    queryFn: () => getEmployee(id),
    enabled: orgId > 0 && Number.isInteger(id) && id > 0,
    // Errors (404/403) are shown as-is; retrying a "not found" only delays the message.
    retry: false,
  });
}

export function useEmployeeStatusHistory(
  id: number,
  page: number,
  limit: number,
) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "history", id, page, limit),
    queryFn: () => listStatusHistory(id, page, limit),
    enabled: orgId > 0 && id > 0,
  });
}

export function useLookup(
  path: Parameters<typeof listLookup>[0],
  enabled: boolean,
) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, "hr-lookup", path),
    queryFn: () => listLookup(path),
    enabled: enabled && orgId > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateEmployee() {
  return useOrgScopedMutation([KEY], (body: Record<string, unknown>) =>
    createEmployee(body),
  );
}

export function useUpdateEmployee() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      updateEmployee(id, body),
  );
}

export function useChangeEmployeeStatus() {
  return useOrgScopedMutation(
    [KEY],
    ({
      id,
      body,
      correction,
    }: {
      id: number;
      body: StatusChangeBody;
      correction: boolean;
    }) => changeEmployeeStatus(id, body, correction),
  );
}

export function useLinkEmployeeUser() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number; body: LinkAccountBody }) =>
      linkEmployeeUser(id, body),
  );
}

export function useUnlinkEmployeeUser() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number; body: UnlinkAccountBody }) =>
      unlinkEmployeeUser(id, body),
  );
}
