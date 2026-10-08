"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { useOrgScopedMutation } from "@/lib/use-org-scoped-mutation";
import {
  approveCorrection,
  listCorrections,
  rejectCorrection,
  submitCorrection,
  type CorrectionListQuery,
  type DecideCorrectionBody,
  type SubmitCorrectionBody,
} from "./api";

const KEY = "hr-attendance-corrections" as const;

function useOrgId() {
  return useAuthStore((s) => s.organizationId ?? 0);
}

export function useCorrections(query: CorrectionListQuery) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: orgScopedKey(orgId, KEY, "list", query),
    queryFn: () => listCorrections(query),
    enabled: orgId > 0,
  });
}

export function useSubmitCorrection() {
  return useOrgScopedMutation([KEY], (body: SubmitCorrectionBody) =>
    submitCorrection(body),
  );
}

export function useApproveCorrection() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number; body: DecideCorrectionBody }) =>
      approveCorrection(id, body),
  );
}

export function useRejectCorrection() {
  return useOrgScopedMutation(
    [KEY],
    ({ id, body }: { id: number; body: DecideCorrectionBody }) =>
      rejectCorrection(id, body),
  );
}
