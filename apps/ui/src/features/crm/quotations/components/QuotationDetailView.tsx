"use client";

import { ApiError } from "@texawave-erp/core";
import { Alert, ErrorState, Skeleton } from "@texawave-erp/ui-kit";
import { useQuotation } from "../hooks";
import { QuotationForm } from "./QuotationForm";

/** The combined view/edit screen — legacy has no separate read-only
 * route either (Docs/CRM_QUOTES_LEGACY_PARITY.md §1.1). */
export function QuotationDetailView({ id }: { id: number }) {
  const query = useQuotation(id);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.isPermissionError) {
      return (
        <Alert variant="warning" title="You don't have access to this quote">
          Ask an administrator for the <code>crm.quotation.read</code>{" "}
          permission.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  return <QuotationForm existing={query.data} />;
}
