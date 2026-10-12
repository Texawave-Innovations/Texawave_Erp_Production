import { ApiError } from "@texawave-erp/core";
import { Alert, Card, ErrorState, Skeleton } from "@texawave-erp/ui-kit";

/**
 * The loading / no-access / failed states every payroll list renders before
 * its data (Docs/DESIGN_SYSTEM.md §3). Returns null once the query has data,
 * so the caller renders its empty state or table.
 */
export function QueryState({
  query,
  area,
}: {
  query: {
    isPending: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => unknown;
  };
  area: string;
}) {
  if (query.isPending) {
    return (
      <Card>
        {/* Skeletons are decorative; screen readers hear the status text. */}
        <div role="status" aria-busy="true" className="flex flex-col gap-3">
          <span className="sr-only">Loading {area}…</span>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" aria-hidden="true" />
          ))}
        </div>
      </Card>
    );
  }
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.isPermissionError) {
      return (
        <Alert variant="warning" title={`You don't have access to ${area}`}>
          Ask an administrator to grant the permission.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }
  return null;
}
