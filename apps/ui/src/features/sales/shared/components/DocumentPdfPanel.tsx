"use client";

import { useEffect, useMemo } from "react";
import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { Card, ErrorState, Skeleton } from "@texawave-erp/ui-kit";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { SALES_KEY } from "../query";

/**
 * A saved Sales document's PDF (the server's own file), shown inline.
 * `version` (e.g. updatedAt) refetches it after an edit.
 */
export function DocumentPdfPanel({
  path,
  version,
  title,
}: {
  /** e.g. `/sales/quotations/12/pdf`. */
  path: string;
  version: string;
  title: string;
}) {
  const orgId = useAuthStore((s) => s.organizationId ?? 0);
  const query = useQuery({
    queryKey: orgScopedKey(orgId, SALES_KEY, "pdf", path, version),
    queryFn: () => withAuthRetry(() => apiClient.download(path)),
    enabled: orgId > 0,
    staleTime: Infinity,
  });
  const url = useMemo(
    () => (query.data ? URL.createObjectURL(query.data) : null),
    [query.data],
  );
  // Free the previous blob URL when it is replaced or the panel closes.
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  return (
    <Card className="flex flex-col gap-3">
      {query.isError ? (
        <ErrorState
          title="The PDF could not load"
          onRetry={() => void query.refetch()}
        />
      ) : url ? (
        <iframe
          title={title}
          src={url}
          className="aspect-[210/297] w-full rounded-lg border border-gray-200 dark:border-gray-700"
        />
      ) : (
        <Skeleton className="aspect-[210/297] w-full" />
      )}
    </Card>
  );
}
