"use client";

import { useQuery } from "@tanstack/react-query";
import { orgScopedKey } from "@texawave-erp/core";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  getProfile,
  getSensitive,
  updateProfile,
  updateSensitive,
} from "./api";

const KEY = "hr-profiles" as const;

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

export function useProfile(id: number) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "detail", id),
    queryFn: () => getProfile(id),
    enabled: orgId > 0 && Number.isInteger(id) && id > 0,
    // A 404 or 403 is final; retrying only delays the message.
    retry: false,
  });
}

/**
 * Statutory and bank details are fetched only when the user asks for them,
 * because each read is audited on the server. `enabled` is false until reveal.
 */
export function useSensitive(id: number, enabled: boolean) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "sensitive", id),
    queryFn: () => getSensitive(id),
    enabled: enabled && orgId > 0 && Number.isInteger(id) && id > 0,
    retry: false,
    staleTime: 0,
  });
}

export function useUpdateProfile() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      updateProfile(id, body),
  );
}

export function useUpdateSensitive() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      updateSensitive(id, body),
  );
}
