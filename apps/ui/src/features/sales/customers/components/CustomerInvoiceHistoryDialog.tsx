"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, IndianRupee, Pencil, Receipt, Wallet } from "lucide-react";
import {
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Select,
  Skeleton,
  StatCard,
  TableToolbar,
} from "@texawave-erp/ui-kit";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePermission } from "@/hooks/usePermission";
import { InvoiceStatusBadge } from "../../invoices/components/InvoiceStatusBadge";
import { useInvoices } from "../../invoices/hooks";
import type { Invoice, InvoiceStatus } from "../../invoices/types";
import { SALES_PERMISSIONS } from "../../permissions";
import { formatDate, formatInr } from "../../shared/format";
import { useCustomerStatement } from "../hooks";
import type { Customer } from "../types";

type Sort = "newest" | "oldest";

/** A lighter info card: a small brand-coloured heading over its lines. */
function InfoCard({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex min-w-0 flex-col gap-1.5 p-4">
      <h3 className="mb-1 text-theme-xs font-bold tracking-wider text-brand-700 uppercase dark:text-brand-300">
        {heading}
      </h3>
      {children}
    </Card>
  );
}

function Line({ label, value }: { label: string; value: string | null }) {
  return (
    <p className="text-theme-sm text-gray-600 dark:text-gray-300">
      <span className="font-semibold text-gray-900 dark:text-white/90">
        {label}:
      </span>{" "}
      {value || "–"}
    </p>
  );
}

function addressLine(c: Customer): string {
  const a = c.defaultAddress;
  if (!a) return "–";
  return (
    [a.street, a.area, a.city, a.stateName, a.pincode]
      .filter(Boolean)
      .join(", ") || "–"
  );
}

export function CustomerInvoiceHistoryDialog({
  customer,
  onClose,
  onOpenStatement,
}: {
  /** null = closed. */
  customer: Customer | null;
  onClose: () => void;
  onOpenStatement: () => void;
}) {
  const router = useRouter();
  const canWrite = usePermission(SALES_PERMISSIONS.customerWrite);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | InvoiceStatus>("");
  const [sort, setSort] = useState<Sort>("newest");
  const debounced = useDebouncedValue(search.trim(), 300);
  const id = customer?.id ?? null;

  const invoices = useInvoices(
    {
      page: 1,
      limit: 100,
      invoiceType: "TAX",
      customerId: id ?? 0,
      ...(debounced ? { search: debounced } : {}),
      ...(status ? { status } : {}),
    },
    id !== null,
  );
  // All-time totals come from the server ledger, not a page of invoices.
  const totals = useCustomerStatement(id, {});

  const rows = useMemo(() => {
    const list = [...(invoices.data?.data ?? [])];
    list.sort((a, b) =>
      sort === "newest"
        ? b.invoiceDate.localeCompare(a.invoiceDate)
        : a.invoiceDate.localeCompare(b.invoiceDate),
    );
    return list;
  }, [invoices.data, sort]);

  const filtered = debounced !== "" || status !== "";

  return (
    <Dialog
      open={customer !== null}
      onClose={onClose}
      title={
        customer ? (
          <div className="flex min-w-0 flex-col gap-1.5 pr-2">
            <h2
              id="dialog-title"
              className="truncate text-xl font-bold tracking-tight text-gray-900 dark:text-white/90"
            >
              {customer.companyName}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-theme-xs text-gray-500 dark:text-gray-400">
              <span className="inline-flex rounded-full bg-brand-50 px-2.5 py-0.5 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                {customer.customerCode}
              </span>
              <span aria-hidden="true">•</span>
              <span>Contact: {customer.contactPerson}</span>
            </div>
          </div>
        ) : (
          ""
        )
      }
      size="5xl"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={onOpenStatement}>
            <FileText className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Statement
          </Button>
          {canWrite && customer ? (
            <Button
              variant="secondary"
              onClick={() =>
                router.push(`/sales/customers/${customer.id}/edit`)
              }
            >
              <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Edit customer
            </Button>
          ) : null}
        </div>

        {customer ? (
          <div className="grid gap-3 md:grid-cols-3">
            <InfoCard heading="Contact information">
              <p className="font-semibold text-gray-900 dark:text-white/90">
                {customer.contactPerson}
              </p>
              <p className="text-theme-sm text-gray-600 dark:text-gray-300">
                {customer.mobileCountryCode} {customer.mobileNumber}
              </p>
              <p className="text-theme-sm break-all text-gray-600 dark:text-gray-300">
                {customer.email}
              </p>
            </InfoCard>
            <InfoCard heading="Tax & address">
              <Line label="GST" value={customer.gstin} />
              <Line label="PAN" value={customer.pan} />
              <p
                className="line-clamp-2 text-theme-sm text-gray-600 dark:text-gray-300"
                title={addressLine(customer)}
              >
                {addressLine(customer)}
              </p>
            </InfoCard>
            <InfoCard heading="Bank details">
              {customer.bankName ? (
                <>
                  <Line label="Bank" value={customer.bankName} />
                  <Line
                    label="Account"
                    value={customer.bankAccountNumberMasked}
                  />
                  <Line label="IFSC" value={customer.bankIfsc} />
                  <Line label="Branch" value={customer.bankBranch} />
                </>
              ) : (
                <p className="font-semibold text-gray-900 dark:text-white/90">
                  No bank details
                </p>
              )}
            </InfoCard>
          </div>
        ) : null}

        <div className="grid items-center gap-3 lg:grid-cols-[13rem_1fr]">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white/90">
              Invoice history
            </h3>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              Tax invoices linked to this customer
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              headingId="cust-hist-count"
              label="Total invoices"
              value={invoices.data?.meta.total ?? 0}
              note="Tax invoices"
              tone="neutral"
              icon={Receipt}
            />
            <StatCard
              headingId="cust-hist-billed"
              label="Total billed"
              value={formatInr(totals.data?.totalInvoiced ?? 0)}
              note="All time"
              tone="blue"
              icon={IndianRupee}
            />
            <StatCard
              headingId="cust-hist-paid"
              label="Paid amount"
              value={formatInr(totals.data?.totalReceived ?? 0)}
              note="All time"
              tone="success"
              icon={Wallet}
            />
            <StatCard
              headingId="cust-hist-due"
              label="Outstanding"
              value={formatInr(totals.data?.closingBalance ?? 0)}
              note="Unpaid balance"
              tone="error"
              icon={Wallet}
            />
          </div>
        </div>

        <TableToolbar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Filter invoices by number, items…",
            ariaLabel: "Filter invoices",
          }}
          filters={
            <>
              <Select
                aria-label="Filter by status"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "" | InvoiceStatus)
                }
              >
                <option value="">All statuses</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIALLY_PAID">Partially paid</option>
                <option value="PAID">Paid</option>
              </Select>
              <Select
                aria-label="Sort invoices"
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </Select>
            </>
          }
          hasActiveFilters={filtered}
          onClearFilters={() => {
            setSearch("");
            setStatus("");
          }}
        />

        {invoices.isPending ? (
          <Skeleton className="h-48 w-full" />
        ) : invoices.isError ? (
          <ErrorState onRetry={() => void invoices.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No invoices found for this customer"
            description={
              filtered
                ? "Try another search or clear the filters."
                : "This customer has no linked invoices in the system yet."
            }
          />
        ) : (
          <DataTable<Invoice>
            caption="Customer invoices"
            rows={rows}
            getRowKey={(i) => String(i.id)}
            onRowClick={(i) => router.push(`/sales/invoices/${i.id}`)}
            columns={[
              { header: "Number", cell: (i) => i.invoiceNumber },
              { header: "Date", cell: (i) => formatDate(i.invoiceDate) },
              { header: "Due", cell: (i) => formatDate(i.dueDate) },
              {
                header: "Total",
                align: "right",
                cell: (i) => formatInr(i.totalAmount),
              },
              {
                header: "Paid",
                align: "right",
                cell: (i) => formatInr(i.amountReceived),
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
        )}
      </div>
    </Dialog>
  );
}
