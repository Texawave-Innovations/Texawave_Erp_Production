"use client";

import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/stores/auth-store";
import { SALES_PERMISSIONS } from "../permissions";
import {
  listMasterOptions,
  type MasterDocumentType,
  type MasterField,
  type MasterOption,
} from "./documents";
import { SALES_KEY } from "./query";

/**
 * The Sales master-list options of one document type, grouped by field
 * (validity, terms, HSN codes, bank accounts, seals, signatures,
 * prepared-by...). Empty without `sales.master.read` — forms then fall back
 * to typed values.
 */
export function useMasterOptions(documentType: MasterDocumentType) {
  const orgId = useAuthStore((s) => s.organizationId ?? 0);
  const canRead = usePermission(SALES_PERMISSIONS.masterRead);
  const query = useQuery({
    queryKey: orgScopedKey(orgId, SALES_KEY, "master-options", documentType),
    queryFn: () => listMasterOptions(documentType),
    enabled: canRead && orgId > 0,
    staleTime: 5 * 60 * 1000,
  });
  const byField = (field: MasterField): MasterOption[] =>
    (query.data ?? [])
      .filter((o) => o.field === field)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const defaultOf = (field: MasterField): MasterOption | undefined =>
    byField(field).find((o) => o.isDefault);
  return { ...query, byField, defaultOf };
}
