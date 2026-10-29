"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  DataTable,
  DatePicker,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Select,
  TableSkeleton,
  TableToolbar,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { SALES_PERMISSIONS } from "../../permissions";
import { formatDate, formatInr } from "../../shared/format";
import { useQuotations } from "../hooks";
import type { Quotation, QuotationStatus } from "../types";
import { QuotationStatusBadge } from "./QuotationDetailView";

const PAGE_SIZE = 20;

export function QuotationsView() {
  const router = useRouter();
  const canRead = usePermission(SALES_PERMISSIONS.quotationRead);
  const canWrite = usePermission(SALES_PERMISSIONS.quotationWrite);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | QuotationStatus>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debounced = useDebouncedValue(search.trim(), 300);

  const query = useQuotations({
    page,
    limit: PAGE_SIZE,
    ...(debounced ? { search: debounced } : {}),
    ...(status ? { status } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to quotations">
        Ask an administrator for the <code>sales.quotation.read</code>{" "}
        permission.
      </Alert>
    );
  }

  const filtered = Boolean(debounced || status || from || to);
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };
  const newButton = canWrite ? (
    <Button onClick={() => router.push("/sales/quotations/new")}>
      <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
      New quotation
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        title="Quotations"
        description="Quotes to customers; convert one to a proforma or tax invoice."
        icon={FileText}
        badge={
          query.data ? (
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
              {query.data.meta.total} quotations
            </span>
          ) : undefined
        }
        action={newButton}
      />

      <TableToolbar
        search={{
          value: search,
          onChange: (v) => reset(() => setSearch(v)),
          placeholder: "Search number, customer, prepared by…",
          ariaLabel: "Search quotations",
        }}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Filter by status"
              value={status}
              onChange={(e) =>
                reset(() => setStatus(e.target.value as "" | QuotationStatus))
              }
            >
              <option value="">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="CONVERTED">Converted</option>
            </Select>
            <DatePicker
              aria-label="From date"
              value={from}
              onChange={(e) => reset(() => setFrom(e.target.value))}
            />
            <DatePicker
              aria-label="To date"
              value={to}
              min={from || undefined}
              onChange={(e) => reset(() => setTo(e.target.value))}
            />
          </div>
        }
        hasActiveFilters={filtered}
        onClearFilters={() =>
          reset(() => {
            setSearch("");
            setStatus("");
            setFrom("");
            setTo("");
          })
        }
        resultCount={query.data?.meta.total}
      />

      {query.isPending ? (
        <TableSkeleton rowsCount={6} columnsCount={6} />
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to quotations">
            Your access has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void query.refetch()} />
        )
      ) : query.data.data.length === 0 ? (
        filtered ? (
          <EmptyState
            title="No quotations matched your filters"
            description="Try another search or clear the filters."
          />
        ) : (
          <EmptyState
            title="No quotations yet"
            description="Create your first quotation."
            action={newButton}
          />
        )
      ) : (
        <>
          <DataTable<Quotation>
            caption="Quotations"
            rows={query.data.data}
            getRowKey={(q) => String(q.id)}
            onRowClick={(q) => router.push(`/sales/quotations/${q.id}`)}
            columns={[
              {
                header: "Number",
                cell: (q) => (
                  <span className="font-mono text-theme-sm font-medium text-gray-900 dark:text-white/90">
                    {q.quotationNumber}
                  </span>
                ),
              },
              { header: "Date", cell: (q) => formatDate(q.quotationDate) },
              {
                header: "Customer",
                cell: (q) => (
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900 dark:text-white/90">
                      {q.customerSnapshot.companyName}
                    </span>
                    <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                      {q.customerSnapshot.customerCode}
                    </span>
                  </div>
                ),
              },
              { header: "Items", align: "right", cell: (q) => q.lines.length },
              {
                header: "Total",
                align: "right",
                cell: (q) => (
                  <span className="font-semibold">
                    {formatInr(q.totalAmount)}
                  </span>
                ),
              },
              {
                header: "Status",
                cell: (q) => <QuotationStatusBadge status={q.status} />,
              },
            ]}
          />
          <Pagination
            page={query.data.meta.page}
            totalPages={query.data.meta.totalPages}
            totalItems={query.data.meta.total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
