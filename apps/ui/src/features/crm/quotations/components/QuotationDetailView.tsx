"use client";

import { EmptyState } from "@/features/crm/legacy-ui/CrmCommon";
import { ApiError } from "@texawave-erp/core";
import { Receipt } from "lucide-react";
import { useQuotation } from "../hooks";
import { QuotationForm } from "./QuotationForm";

/** The combined view/edit screen — legacy has no separate read-only
 * route either (Docs/CRM_QUOTES_LEGACY_PARITY.md §1.1). */
export function QuotationDetailView({ id }: { id: number }) {
  const query = useQuotation(id);

  if (query.isPending) {
    return (
      <div className="text-center py-16 text-slate-400 text-xs">
        Loading Quote…
      </div>
    );
  }
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.isPermissionError) {
      return (
        <EmptyState
          icon={Receipt}
          title="You don't have access to this quote"
          description="Ask an administrator for the crm.quotation.read permission."
        />
      );
    }
    return (
      <div className="text-center py-16 text-xs text-red-500">
        Could not load this quote.{" "}
        <button
          type="button"
          className="underline"
          onClick={() => void query.refetch()}
        >
          Retry
        </button>
      </div>
    );
  }

  return <QuotationForm existing={query.data} />;
}
