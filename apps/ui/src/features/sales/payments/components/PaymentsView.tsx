"use client";

import { useState } from "react";
import Link from "next/link";
import { BellRing, Plus, Wallet } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  ActionMenu,
  Alert,
  Button,
  DataTable,
  DeleteConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Pagination,
  StatusBadge,
  TableSkeleton,
  TableToolbar,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { SALES_PERMISSIONS } from "../../permissions";
import { DocumentPdfPanel } from "../../shared/components/DocumentPdfPanel";
import { downloadPdf, pdfFileName } from "../../shared/documents";
import { formatDate, formatInr } from "../../shared/format";
import { receiptPath } from "../api";
import { useDeletePayment, usePaymentAlerts, usePayments } from "../hooks";
import type { Payment } from "../types";
import { PaymentFormDialog } from "./PaymentFormDialog";

const PAGE_SIZE = 20;

function BalanceBadge({ p }: { p: Payment }) {
  const balance = Number(p.invoice.balance);
  return balance <= 0 ? (
    <StatusBadge label={`${formatInr(0)} (Paid)`} colorToken="success" />
  ) : (
    <StatusBadge
      label={formatInr(p.invoice.balance)}
      colorToken={p.overdueDays ? "error" : "warning"}
    />
  );
}

function DueCell({ p }: { p: Payment }) {
  if (!p.effectiveDueDate) return <>—</>;
  return (
    <div className="flex flex-col gap-1">
      <span
        className={
          p.overdueDays
            ? "font-semibold text-error-700 dark:text-error-400"
            : undefined
        }
      >
        {formatDate(p.effectiveDueDate)}
      </span>
      {p.overdueDays ? (
        <StatusBadge label={`Overdue (${p.overdueDays}d)`} colorToken="error" />
      ) : null}
    </div>
  );
}

export function PaymentsView() {
  const { toast } = useToast();
  const canRead = usePermission(SALES_PERMISSIONS.paymentRead);
  const canWrite = usePermission(SALES_PERMISSIONS.invoicePaymentWrite);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [paymentMonth, setPaymentMonth] = useState("");
  const [dueMonth, setDueMonth] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [recording, setRecording] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [viewing, setViewing] = useState<Payment | null>(null);
  const [deleting, setDeleting] = useState<Payment | null>(null);
  const debounced = useDebouncedValue(search.trim(), 300);
  const remove = useDeletePayment();

  const alerts = usePaymentAlerts(canRead);
  const query = usePayments(
    {
      page,
      limit: PAGE_SIZE,
      ...(debounced ? { search: debounced } : {}),
      ...(paymentMonth ? { paymentMonth } : {}),
      ...(dueMonth ? { dueMonth } : {}),
      ...(overdueOnly ? { overdueOnly: true } : {}),
    },
    canRead,
  );

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to payments">
        Ask an administrator for the <code>sales.payment.read</code> permission.
      </Alert>
    );
  }

  const filtered = Boolean(
    debounced || paymentMonth || dueMonth || overdueOnly,
  );
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  async function download(p: Payment) {
    try {
      await downloadPdf(receiptPath(p.id), pdfFileName(p.paymentNumber));
    } catch {
      toast({ title: "Could not download the receipt", variant: "error" });
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast({ title: `${deleting.paymentNumber} deleted`, variant: "success" });
    } catch (e) {
      toast({
        title: e instanceof ApiError ? e.message : "Could not delete",
        variant: "error",
      });
    } finally {
      setDeleting(null);
    }
  }

  const a = alerts.data;

  return (
    <div className="flex flex-col gap-5">
      {a && a.overduePayments > 0 ? (
        <Alert variant="warning" title="Due date intimation">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {a.overduePayments} overdue payment
              {a.overduePayments === 1 ? "" : "s"} on {a.overdueInvoices}{" "}
              invoice{a.overdueInvoices === 1 ? "" : "s"} —{" "}
              {formatInr(a.overdueBalance)} outstanding.
            </span>
            <Button
              size="sm"
              variant={overdueOnly ? "destructive" : "secondary"}
              aria-pressed={overdueOnly}
              onClick={() => reset(() => setOverdueOnly((v) => !v))}
            >
              <BellRing className="mr-1.5 h-4 w-4" aria-hidden="true" />
              {overdueOnly ? "Show all payments" : "Filter overdue only"}
            </Button>
          </div>
        </Alert>
      ) : null}

      <PageHeader
        variant="banner"
        title="Payments received"
        description="Client payments against invoices, with receipts and due dates."
        icon={Wallet}
        action={
          canWrite ? (
            <Button onClick={() => setRecording(true)}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Record payment
            </Button>
          ) : null
        }
      />

      <TableToolbar
        search={{
          value: search,
          onChange: (v) => reset(() => setSearch(v)),
          placeholder: "Search payment no, customer, invoice, reference…",
          ariaLabel: "Search payments",
        }}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="month"
              aria-label="Payment month"
              value={paymentMonth}
              onChange={(e) => reset(() => setPaymentMonth(e.target.value))}
            />
            <Input
              type="month"
              aria-label="Due month"
              value={dueMonth}
              onChange={(e) => reset(() => setDueMonth(e.target.value))}
            />
          </div>
        }
        hasActiveFilters={filtered}
        onClearFilters={() =>
          reset(() => {
            setSearch("");
            setPaymentMonth("");
            setDueMonth("");
            setOverdueOnly(false);
          })
        }
        resultCount={query.data?.meta.total}
      />

      {query.isPending ? (
        <TableSkeleton rowsCount={6} columnsCount={8} />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data.data.length === 0 ? (
        <EmptyState
          title={
            filtered ? "No payments matched your filters" : "No payments yet"
          }
          description={
            filtered
              ? "Try another search or clear the filters."
              : "Record a payment against an invoice."
          }
        />
      ) : (
        <>
          <DataTable<Payment>
            caption="Payments received"
            rows={query.data.data}
            getRowKey={(p) => String(p.id)}
            columns={[
              {
                header: "Payment no",
                cell: (p) => (
                  <span className="font-mono text-theme-sm font-medium text-gray-900 dark:text-white/90">
                    {p.paymentNumber}
                  </span>
                ),
              },
              { header: "Customer", cell: (p) => p.customer.companyName },
              {
                header: "Invoice",
                cell: (p) => (
                  <Link
                    href={`/sales/invoices/${p.invoice.id}`}
                    className="font-mono text-theme-sm text-brand-700 hover:underline dark:text-brand-400"
                    title="Open the invoice"
                  >
                    {p.invoice.invoiceNumber}
                  </Link>
                ),
              },
              {
                header: "Payment date",
                cell: (p) => formatDate(p.paymentDate),
              },
              { header: "Due date", cell: (p) => <DueCell p={p} /> },
              {
                header: "Invoice total",
                align: "right",
                cell: (p) => formatInr(p.invoice.totalAmount),
              },
              {
                header: "Received",
                align: "right",
                cell: (p) => (
                  <span className="font-semibold">{formatInr(p.amount)}</span>
                ),
              },
              { header: "Balance", cell: (p) => <BalanceBadge p={p} /> },
              { header: "Mode", cell: (p) => p.mode },
              { header: "Reference", cell: (p) => p.reference ?? "—" },
              {
                header: "Actions",
                align: "right",
                cell: (p) => (
                  <ActionMenu
                    ariaLabel={`Actions for ${p.paymentNumber}`}
                    items={[
                      { label: "View receipt", onClick: () => setViewing(p) },
                      {
                        label: "Download receipt PDF",
                        onClick: () => void download(p),
                      },
                      ...(canWrite
                        ? [
                            {
                              label: "Edit payment",
                              onClick: () => setEditing(p),
                              separator: true,
                            },
                            {
                              label: "Delete payment",
                              variant: "destructive" as const,
                              onClick: () => setDeleting(p),
                            },
                          ]
                        : []),
                    ]}
                  />
                ),
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

      {recording ? (
        <PaymentFormDialog open onClose={() => setRecording(false)} />
      ) : null}
      {editing ? (
        <PaymentFormDialog
          open
          payment={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {viewing ? (
        <Dialog
          open
          onClose={() => setViewing(null)}
          title={`Receipt ${viewing.paymentNumber}`}
          size="2xl"
        >
          <DocumentPdfPanel
            path={receiptPath(viewing.id)}
            version={viewing.updatedAt}
            title={`Receipt ${viewing.paymentNumber}`}
          />
        </Dialog>
      ) : null}
      <DeleteConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete payment"
        itemName={deleting?.paymentNumber ?? ""}
        description="The invoice balance goes back up. The number is not reused."
        loading={remove.isPending}
      />
    </div>
  );
}
