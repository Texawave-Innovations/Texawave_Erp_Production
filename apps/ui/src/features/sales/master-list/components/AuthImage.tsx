"use client";

import { useEffect, useMemo } from "react";
import { ImageOff } from "lucide-react";
import { orgScopedKey } from "@texawave-erp/core";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@texawave-erp/ui-kit";
import { apiClient, withAuthRetry } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { SALES_KEY } from "../../shared/query";

/**
 * An image the API serves behind auth (company logo, seal, signature).
 * `version` refetches it after an upload.
 */
export function AuthImage({
  path,
  version,
  alt,
  className = "h-16 w-auto max-w-[10rem] object-contain",
}: {
  path: string;
  version: string;
  alt: string;
  className?: string;
}) {
  const orgId = useAuthStore((s) => s.organizationId ?? 0);
  const query = useQuery({
    queryKey: orgScopedKey(orgId, SALES_KEY, "image", path, version),
    queryFn: () => withAuthRetry(() => apiClient.download(path)),
    enabled: orgId > 0,
    staleTime: Infinity,
    retry: false,
  });
  const url = useMemo(
    () => (query.data ? URL.createObjectURL(query.data) : null),
    [query.data],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  if (query.isPending) return <Skeleton className="h-16 w-24" />;
  if (!url) {
    return (
      <span className="inline-flex items-center gap-1 text-theme-xs text-gray-500 dark:text-gray-400">
        <ImageOff className="h-4 w-4" aria-hidden="true" />
        Image unavailable
      </span>
    );
  }
  // A blob: URL of an authenticated file, so a plain <img>.
  return <img src={url} alt={alt} className={className} />;
}
