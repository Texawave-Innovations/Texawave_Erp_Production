"use client";

import type { ReactNode } from "react";
import { ErrorState, Skeleton } from "@texawave-erp/ui-kit";

export interface WidgetStateProps {
  isPending: boolean;
  isError: boolean;
  onRetry?: () => void;
  label: string;
  children: ReactNode;
  skeletonHeight?: string;
}

/**
 * Standardized Loading Skeleton and Error State wrapper for HR widgets.
 * Guarantees uniform error handling and retry mechanism across all HR features.
 */
export function WidgetState({
  isPending,
  isError,
  onRetry,
  label,
  children,
  skeletonHeight = "h-24",
}: WidgetStateProps) {
  if (isError) {
    return (
      <ErrorState
        title={`${label} could not be loaded`}
        description="Figures are hidden rather than shown as zero."
        {...(onRetry ? { onRetry } : {})}
      />
    );
  }

  if (isPending) {
    return (
      <div role="status" className="space-y-2.5">
        <span className="sr-only">Loading {label}</span>
        <Skeleton className={`w-full rounded-2xl ${skeletonHeight}`} />
      </div>
    );
  }

  return <>{children}</>;
}
