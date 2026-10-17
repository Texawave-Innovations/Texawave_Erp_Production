"use client";

import type { CrmCustomFieldModule } from "@texawave-erp/api-types";
import { orgScopedKey } from "@texawave-erp/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth-store";
import { listCustomFields } from "./api";

export function useCustomFields(module?: CrmCustomFieldModule) {
  const organizationId = useAuthStore((s) => s.organizationId);
  return useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "crm-custom-fields",
      module ?? "all",
    ),
    queryFn: () => listCustomFields(module),
    enabled: Boolean(organizationId),
  });
}

/** After an import the list pages (every `crm-*` query) are stale. */
export function useInvalidateCrmAfterImport() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[1] === "string" && q.queryKey[1].startsWith("crm-"),
    });
}
