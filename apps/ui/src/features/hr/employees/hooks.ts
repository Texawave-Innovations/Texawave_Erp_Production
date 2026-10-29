"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orgScopedKey } from "@texawave-erp/core";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import { listTeams } from "@/features/onboarding/api";
import {
  approveOnboarding,
  changeEmployeeStatus,
  createEmployee,
  deleteEmployee,
  getEmployee,
  getEmployeeStats,
  importEmployeesCsv,
  sendBackOnboarding,
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

export function useDeleteEmployee() {
  return useOrgScopedMutation([KEY], (id: number) => deleteEmployee(id));
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

export function useEmployeeStats(enabled = true) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "stats"),
    queryFn: getEmployeeStats,
    enabled: enabled && orgId > 0,
  });
}

/** Active teams for the form's team picker (GET /hr/teams needs write access). */
export function useTeams(enabled: boolean) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, "hr-lookup", "/hr/teams"),
    queryFn: listTeams,
    enabled: enabled && orgId > 0,
    staleTime: 5 * 60 * 1000,
  });
}

/** Approve / send back. Also refreshes the onboarding progress page's query
 * (`features/onboarding`), which is keyed outside the employees prefix. */
export function useReviewOnboarding() {
  const queryClient = useQueryClient();
  const orgId = useOrgId();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      note,
      force,
    }: {
      id: number;
      decision: "approve" | "send_back";
      note: string;
      force?: boolean;
    }) =>
      decision === "approve"
        ? approveOnboarding(id, note || undefined, force)
        : sendBackOnboarding(id, note),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({
        queryKey: orgScopedKey(orgId, KEY),
      });
      void queryClient.invalidateQueries({
        queryKey: ["onboarding", "hr-progress", id],
      });
    },
  });
}

/** A dry run changes nothing, so only a committed import refreshes the list. */
export function useImportEmployees() {
  const queryClient = useQueryClient();
  const orgId = useOrgId();
  return useMutation({
    mutationFn: ({ file, dryRun }: { file: File; dryRun: boolean }) =>
      importEmployeesCsv(file, dryRun),
    onSuccess: (report) => {
      if (report.created.length > 0) {
        void queryClient.invalidateQueries({
          queryKey: orgScopedKey(orgId, KEY),
        });
      }
    },
  });
}

export function useUnlinkEmployeeUser() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number; body: UnlinkAccountBody }) =>
      unlinkEmployeeUser(id, body),
  );
}
