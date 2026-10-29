"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Receipt } from "lucide-react";
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
import { useInvoices } from "../hooks";
import type { Invoice, InvoiceStatus, InvoiceType } from "../types";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

const PAGE_SIZE = 20;

const TITLE: Record<
  InvoiceType,
  { title: string; description: string; new: string }
> = {
  PROFORMA: {
    title: "Proforma invoices",
    description: "Advance bills; move one to a tax invoice when supplied.",
    new: "New proforma invoice",
  },
  TAX: {
    title: "Tax invoices",
    description: "GST invoices; record payments and raise delivery challans.",
    new: "New tax invoice",
  },
};

/** The proforma or tax invoice list (one screen, filtered by type). */
export function InvoicesView({ invoiceType }: { invoiceType: InvoiceType }) {
  const router = useRouter();
  const canRead = usePermission(SALES_PERMISSIONS.invoiceRead);
  const canWrite = usePermission(SALES_PERMISSIONS.invoiceWrite);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | InvoiceStatus>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const debounced = useDebouncedValue(search.trim(), 300);
  const t = TITLE[invoiceType];

  const query = useInvoices(
    {
      page,
      limit: PAGE_SIZE,
      invoiceType,
      ...(debounced ? { search: debounced } : {}),
      ...(status ? { status } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    },
    canRead,
  );

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to invoices">
        Ask an administrator for the <code>sales.invoice.read</code> permission.
      </Alert>
    );
  }

  const filtered = Boolean(debounced || status || from || to);
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };
  const newButton = canWrite ? (
    <Button
      onClick={() =>
        router.push(
          `/sales/invoices/new/${invoiceType === "PROFORMA" ? "proforma" : "tax"}`,
        )
      }
    >
      <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
      {t.new}
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        title={t.title}
        description={t.description}
        icon={Receipt}
        badge={
          query.data ? (
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
              {query.data.meta.total} invoices
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
          ariaLabel: "Search invoices",
        }}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Filter by status"
              value={status}
              onChange={(e) =>
                reset(() => setStatus(e.target.value as "" | InvoiceStatus))
              }
            >
              <option value="">All statuses</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIALLY_PAID">Partially paid</option>
              <option value="PAID">Paid</option>
              {invoiceType === "PROFORMA" ? (
                <option value="CONVERTED">Moved to tax invoice</option>
              ) : null}
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
        <TableSkeleton rowsCount={6} columnsCount={7} />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        filtered ? (
          <EmptyState
            title="No invoices matched your filters"
            description="Try another search or clear the filters."
          />
        ) : (
          <EmptyState
            title={`No ${t.title.toLowerCase()} yet`}
            description="Create one, or convert a quotation."
            action={newButton}
          />
        )
      ) : (
        <>
          <DataTable<Invoice>
            caption={t.title}
            rows={query.data.data}
            getRowKey={(i) => String(i.id)}
            onRowClick={(i) => router.push(`/sales/invoices/${i.id}`)}
            columns={[
              {
                header: "Number",
                cell: (i) => (
                  <span className="font-mono text-theme-sm font-medium text-gray-900 dark:text-white/90">
                    {i.invoiceNumber}
                  </span>
                ),
              },
              { header: "Date", cell: (i) => formatDate(i.invoiceDate) },
              {
                header: "Customer",
                cell: (i) => (
                  <span className="font-semibold text-gray-900 dark:text-white/90">
                    {i.customerSnapshot.companyName}
                  </span>
                ),
              },
              { header: "Due", cell: (i) => formatDate(i.dueDate) },
              {
                header: "Total",
                align: "right",
                cell: (i) => (
                  <span className="font-semibold">
                    {formatInr(i.totalAmount)}
                  </span>
                ),
              },
              {
                header: "Balance",
                align: "right",
                cell: (i) => formatInr(i.balance),
              },
              {
                header: "Status",
                cell: (i) => <InvoiceStatusBadge status={i.status} />,
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
