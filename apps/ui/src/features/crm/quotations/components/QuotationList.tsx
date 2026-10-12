"use client";

import type { Quotation } from "@texawave-erp/api-types";
import { ApiError, QUOTATION_STATUSES } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Select,
  Skeleton,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDeleteQuotation, useQuotations } from "../hooks";

const PAGE_SIZE = 20;

const STATUS_COLOR: Record<
  string,
  "brand" | "gray" | "success" | "warning" | "error"
> = {
  Draft: "gray",
  Sent: "brand",
  Accepted: "success",
  Rejected: "error",
  Expired: "warning",
};

/** Reproduces legacy Quotes.tsx: search across quotationNumber/subject/
 * account name, a status filter (ALL + the 5 statuses — Quotes has one,
 * unlike Products), client-side-equivalent pagination, and "View"/"Edit"
 * both navigating to the same combined route (legacy has no separate
 * read-only detail page either — Docs/CRM_QUOTES_LEGACY_PARITY.md §1.1).
 * No sort controls — legacy has none. */
export function QuotationList() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const { toast } = useToast();

  const query = useQuotations({
    page,
    limit: PAGE_SIZE,
    q: search || undefined,
    status: (statusFilter as never) || undefined,
  });
  const deleteMutation = useDeleteQuotation();

  async function handleDelete(quote: Quotation) {
    try {
      await deleteMutation.mutateAsync(quote.id);
      toast({
        title: `Deleted quote ${quote.quotationNumber}`,
        variant: "success",
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : `Could not delete ${quote.quotationNumber}`;
      toast({ title: message, variant: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Quotes
        </h1>
        <Button onClick={() => router.push("/crm/quotes/new")}>
          New Quote
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Input
          placeholder="Search quote #, subject, account..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <div className="w-44">
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            {QUOTATION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {query.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to CRM quotes">
            Ask an administrator for the <code>crm.quotation.read</code>{" "}
            permission.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void query.refetch()} />
        )
      ) : query.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title={search ? `No quotes match "${search}"` : "No quotes yet"}
            description="Create a quote from here, or from a Deal's Quotes section."
          />
        </Card>
      ) : (
        <>
          <DataTable<Quotation>
            columns={[
              {
                header: "Quote #",
                cell: (q) => (
                  <Link
                    href={`/crm/quotes/${q.id}`}
                    className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    {q.quotationNumber}
                  </Link>
                ),
              },
              { header: "Account", cell: (q) => q.account.name },
              { header: "Deal", cell: (q) => q.opportunity?.title ?? "—" },
              {
                header: "Status",
                cell: (q) => (
                  <StatusBadge
                    label={q.status}
                    colorToken={STATUS_COLOR[q.status] ?? "gray"}
                  />
                ),
              },
              {
                header: "Valid Until",
                cell: (q) => q.validUntil?.slice(0, 10) ?? "—",
              },
              {
                header: "Grand Total",
                cell: (q) => `${q.currency ?? "INR"} ${q.grandTotal}`,
              },
              {
                header: "",
                headerClassName: "sr-only",
                className: "text-right",
                cell: (q) => (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/crm/quotes/${q.id}`)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDelete(q)}
                      aria-label={`Delete ${q.quotationNumber}`}
                    >
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
            rows={query.data.data}
            getRowKey={(q) => String(q.id)}
          />
          <Pagination
            page={query.data.meta.page}
            totalPages={query.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
