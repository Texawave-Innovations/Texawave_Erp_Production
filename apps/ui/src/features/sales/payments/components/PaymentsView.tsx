"use client";

import { useState } from "react";
import {
  BellRing,
  Download,
  Eye,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  ActionMenu,
  Alert,
  Button,
  DataTable,
  DateRangePicker,
  DeleteConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  TableSkeleton,
  TableToolbar,
} from "@texawave-erp/ui-kit";
import { useNotify } from "@/hooks/useNotify";
import { usePermission } from "@/hooks/usePermission";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { SALES_PERMISSIONS } from "../../permissions";
import { DocumentPdfPanel } from "../../shared/components/DocumentPdfPanel";
import { downloadPdf, pdfFileName } from "../../shared/documents";
import { formatInr } from "../../shared/format";
import { receiptPath } from "../api";
import { useDeletePayment, usePaymentAlerts, usePayments } from "../hooks";
import type { Payment } from "../types";
import { BalanceBadge, DateBox, DueCell, InvoiceRefPill } from "./PaymentCells";
import { PaymentFormDialog } from "./PaymentFormDialog";

const PAGE_SIZE = 20;

export function PaymentsView() {
  const { notify, notifyError } = useNotify();
  const canRead = usePermission(SALES_PERMISSIONS.paymentRead);
  const canWrite = usePermission(SALES_PERMISSIONS.invoicePaymentWrite);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [paymentFrom, setPaymentFrom] = useState("");
  const [paymentTo, setPaymentTo] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
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
      ...(paymentFrom ? { paymentFrom } : {}),
      ...(paymentTo ? { paymentTo } : {}),
      ...(dueFrom ? { dueFrom } : {}),
      ...(dueTo ? { dueTo } : {}),
      ...(overdueOnly ? { overdueOnly: true } : {}),
    },
    canRead,
  );

  if (!canRead) {
    return (
      <Alert
        dismissible
        variant="warning"
        title="You don't have access to payments"
      >
        Ask an administrator for the <code>sales.payment.read</code> permission.
      </Alert>
    );
  }

  const filtered = Boolean(
    debounced || paymentFrom || paymentTo || dueFrom || dueTo || overdueOnly,
  );
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  async function download(p: Payment) {
    try {
      await downloadPdf(receiptPath(p.id), pdfFileName(p.paymentNumber));
    } catch {
      notify("sales.payment.receiptFailed");
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      notify("sales.document.deleted", { number: deleting.paymentNumber });
    } catch (e) {
      notifyError(e, "sales.document.deleteFailed");
    } finally {
      setDeleting(null);
    }
  }

  const a = alerts.data;

  return (
    <div className="flex flex-col gap-5">
      {a && a.overduePayments > 0 ? (
        <Alert dismissible variant="warning" title="Due date intimation">
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
            <DateRangePicker
              value={{ from: paymentFrom, to: paymentTo }}
              fromAriaLabel="Paid from"
              toAriaLabel="Paid to"
              placeholder="Payment date range"
              className="sm:w-64"
              onChange={(r) =>
                reset(() => {
                  setPaymentFrom(r.from);
                  setPaymentTo(r.to);
                })
              }
            />
            <DateRangePicker
              value={{ from: dueFrom, to: dueTo }}
              fromAriaLabel="Due from"
              toAriaLabel="Due to"
              placeholder="Due date range"
              className="sm:w-64"
              onChange={(r) =>
                reset(() => {
                  setDueFrom(r.from);
                  setDueTo(r.to);
                })
              }
            />
          </div>
        }
        hasActiveFilters={filtered}
        onClearFilters={() =>
          reset(() => {
            setSearch("");
            setPaymentFrom("");
            setPaymentTo("");
            setDueFrom("");
            setDueTo("");
            setOverdueOnly(false);
          })
        }
        resultCount={query.data?.meta.total}
      />

      {query.isPending ? (
        <TableSkeleton rowsCount={6} columnsCount={11} />
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
                align: "center",
                cell: (p) => (
                  <span className="text-theme-sm font-bold text-gray-900 dark:text-white/90">
                    {p.paymentNumber}
                  </span>
                ),
              },
              {
                header: "Customer",
                align: "center",
                cell: (p) => (
                  <span className="font-bold text-gray-900 dark:text-white/90">
                    {p.customer.companyName}
                  </span>
                ),
              },
              {
                header: "Invoice ref",
                align: "center",
                cell: (p) => <InvoiceRefPill p={p} />,
              },
              {
                header: "Payment date",
                align: "center",
                cell: (p) => <DateBox value={p.paymentDate} />,
              },
              {
                header: "Due date",
                align: "center",
                cell: (p) => <DueCell p={p} />,
              },
              {
                header: "Total amount",
                align: "center",
                cell: (p) => (
                  <span className="font-bold">
                    {formatInr(p.invoice.totalAmount)}
                  </span>
                ),
              },
              {
                header: "Amount received",
                align: "center",
                cell: (p) => (
                  <span className="font-bold text-success-700 dark:text-emerald-300">
                    {formatInr(p.amount)}
                  </span>
                ),
              },
              {
                header: "Balance",
                align: "center",
                cell: (p) => <BalanceBadge p={p} />,
              },
              {
                header: "Mode",
                align: "center",
                cell: (p) => <span className="font-medium">{p.mode}</span>,
              },
              {
                header: "Reference",
                align: "center",
                cell: (p) => p.reference ?? "—",
              },
              {
                header: "Actions",
                align: "center",
                cell: (p) => {
                  const cls = "h-4 w-4";
                  return (
                    <ActionMenu
                      triggerIcon="horizontal"
                      ariaLabel={`Actions for ${p.paymentNumber}`}
                      items={[
                        {
                          label: "View receipt",
                          icon: <Eye className={cls} aria-hidden="true" />,
                          onClick: () => setViewing(p),
                        },
                        {
                          label: "Download receipt PDF",
                          icon: <Download className={cls} aria-hidden="true" />,
                          onClick: () => void download(p),
                        },
                        ...(canWrite
                          ? [
                              {
                                label: "Edit payment",
                                icon: (
                                  <Pencil className={cls} aria-hidden="true" />
                                ),
                                onClick: () => setEditing(p),
                                separator: true,
                              },
                              {
                                label: "Delete payment",
                                icon: (
                                  <Trash2 className={cls} aria-hidden="true" />
                                ),
                                variant: "destructive" as const,
                                onClick: () => setDeleting(p),
                              },
                            ]
                          : []),
                      ]}
                    />
                  );
                },
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
