"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  CreditCard,
  Download,
  Eye,
  FileCheck,
  Mail,
  Pencil,
  Plus,
  Receipt,
  RotateCcw,
  Share2,
  Trash2,
  Truck,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  ActionMenu,
  Alert,
  Button,
  ConfirmDialog,
  DataTable,
  DateRangePicker,
  DeleteConfirmDialog,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
  TableSkeleton,
  TableToolbar,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useCustomers } from "../../customers/hooks";
import { PaymentFormDialog } from "../../payments/components/PaymentFormDialog";
import { SALES_PERMISSIONS } from "../../permissions";
import { DateActionDialog } from "../../shared/components/DateActionDialog";
import { ReasonActionDialog } from "../../shared/components/ReasonActionDialog";
import { SendEmailDialog } from "../../shared/components/SendEmailDialog";
import { downloadPdf, pdfFileName, whatsappLink } from "../../shared/documents";
import { formatDate, formatInr } from "../../shared/format";
import { INVOICES } from "../api";
import {
  useConvertToTax,
  useCreateChallanFromInvoice,
  useDeleteInvoice,
  useInvoices,
  useMarkProformaConverted,
  useReopenProforma,
} from "../hooks";
import {
  INVOICE_LABEL,
  type Invoice,
  type InvoiceStatus,
  type InvoiceType,
} from "../types";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

const PAGE_SIZE = 20;

type RowDialog =
  "email" | "payment" | "tax" | "markTax" | "reopen" | "challan" | "delete";

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
  const { toast } = useToast();
  const canRead = usePermission(SALES_PERMISSIONS.invoiceRead);
  const canWrite = usePermission(SALES_PERMISSIONS.invoiceWrite);
  const canDelete = usePermission(SALES_PERMISSIONS.invoiceDelete);
  const canSend = usePermission(SALES_PERMISSIONS.invoiceSend);
  const canPay = usePermission(SALES_PERMISSIONS.invoicePaymentWrite);
  const canChallan = usePermission(SALES_PERMISSIONS.deliveryChallanWrite);
  const canPickCustomer = usePermission(SALES_PERMISSIONS.customerRead);
  const remove = useDeleteInvoice();
  const toTax = useConvertToTax();
  const markTax = useMarkProformaConverted();
  const reopen = useReopenProforma();
  const toChallan = useCreateChallanFromInvoice();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | InvoiceStatus>("");
  const [customerId, setCustomerId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [target, setTarget] = useState<{
    invoice: Invoice;
    dialog: RowDialog;
  } | null>(null);
  const debounced = useDebouncedValue(search.trim(), 300);
  const t = TITLE[invoiceType];

  const customers = useCustomers({ page: 1, limit: 100 }, canPickCustomer);
  const query = useInvoices(
    {
      page,
      limit: PAGE_SIZE,
      invoiceType,
      ...(debounced ? { search: debounced } : {}),
      ...(status ? { status } : {}),
      ...(customerId ? { customerId: Number(customerId) } : {}),
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

  const filtered = Boolean(debounced || status || customerId || from || to);
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

  async function runPdf(i: Invoice) {
    try {
      await downloadPdf(
        `${INVOICES}/${i.id}/pdf`,
        pdfFileName(i.invoiceNumber),
      );
    } catch (e) {
      toast({
        title: e instanceof ApiError ? e.message : "Could not download the PDF",
        variant: "error",
      });
    }
  }

  async function runWhatsapp(i: Invoice) {
    try {
      window.open(
        await whatsappLink(`${INVOICES}/${i.id}/whatsapp`),
        "_blank",
        "noopener",
      );
    } catch (e) {
      toast({
        title: e instanceof ApiError ? e.message : "Could not open WhatsApp",
        variant: "error",
      });
    }
  }

  async function handleDelete() {
    if (!target) return;
    const i = target.invoice;
    try {
      await remove.mutateAsync(i.id);
      toast({ title: `${i.invoiceNumber} deleted`, variant: "success" });
    } catch (e) {
      toast({
        title: e instanceof ApiError ? e.message : "Could not delete",
        variant: "error",
      });
    } finally {
      setTarget(null);
    }
  }

  const closeDialog = () => setTarget(null);
  const current = target?.invoice;

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
            {canPickCustomer && customers.data ? (
              <Select
                aria-label="Filter by customer"
                value={customerId}
                onChange={(e) => reset(() => setCustomerId(e.target.value))}
              >
                <option value="">All customers</option>
                {customers.data.data.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.companyName}
                  </option>
                ))}
              </Select>
            ) : null}
            <DateRangePicker
              value={{ from, to }}
              fromAriaLabel="From date"
              toAriaLabel="To date"
              placeholder="Date range"
              showPresets
              className="sm:w-64"
              onChange={(r) =>
                reset(() => {
                  setFrom(r.from);
                  setTo(r.to);
                })
              }
            />
          </div>
        }
        hasActiveFilters={filtered}
        onClearFilters={() =>
          reset(() => {
            setSearch("");
            setStatus("");
            setCustomerId("");
            setFrom("");
            setTo("");
          })
        }
        resultCount={query.data?.meta.total}
      />
      {query.isPending ? (
        <TableSkeleton rowsCount={6} columnsCount={9} />
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
            columns={[
              {
                header: "Number",
                cell: (i) => (
                  <span className="text-theme-sm font-semibold text-brand-700 dark:text-brand-400">
                    {i.invoiceNumber}
                  </span>
                ),
              },
              { header: "Date", cell: (i) => formatDate(i.invoiceDate) },
              { header: "Due", cell: (i) => formatDate(i.dueDate) },
              {
                header: "Customer",
                cell: (i) => (
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900 dark:text-white/90">
                      {i.customerSnapshot.companyName}
                    </span>
                    <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                      {i.customerSnapshot.customerCode}
                    </span>
                  </div>
                ),
              },
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
                header: "Received",
                align: "right",
                cell: (i) => formatInr(i.amountReceived),
              },
              {
                header: "Balance",
                align: "center",
                cell: (i) =>
                  Number(i.balance) > 0 ? (
                    <StatusBadge
                      label={formatInr(i.balance)}
                      colorToken="error"
                    />
                  ) : (
                    <StatusBadge
                      label={`${formatInr(i.balance)} (Paid)`}
                      colorToken="success"
                    />
                  ),
              },
              {
                header: "Status",
                cell: (i) => <InvoiceStatusBadge status={i.status} />,
              },
              {
                header: "Actions",
                align: "center",
                cell: (i) => {
                  const live = i.status !== "CONVERTED";
                  const cls = "h-4 w-4";
                  return (
                    <ActionMenu
                      triggerIcon="horizontal"
                      ariaLabel={`Actions for ${i.invoiceNumber}`}
                      items={[
                        {
                          label: "View details",
                          icon: <Eye className={cls} aria-hidden="true" />,
                          onClick: () => router.push(`/sales/invoices/${i.id}`),
                        },
                        {
                          label: "Download PDF",
                          icon: <Download className={cls} aria-hidden="true" />,
                          onClick: () => void runPdf(i),
                        },
                        ...(canSend
                          ? [
                              {
                                label: "Send mail",
                                icon: (
                                  <Mail className={cls} aria-hidden="true" />
                                ),
                                onClick: () =>
                                  setTarget({ invoice: i, dialog: "email" }),
                              },
                              {
                                label: "Share WhatsApp",
                                icon: (
                                  <Share2 className={cls} aria-hidden="true" />
                                ),
                                onClick: () => void runWhatsapp(i),
                              },
                            ]
                          : []),
                        ...(canPay && live && Number(i.balance) > 0
                          ? [
                              {
                                label: "Record payment",
                                icon: (
                                  <CreditCard
                                    className={cls}
                                    aria-hidden="true"
                                  />
                                ),
                                onClick: () =>
                                  setTarget({ invoice: i, dialog: "payment" }),
                              },
                            ]
                          : []),
                        ...(canWrite && live && i.invoiceType === "PROFORMA"
                          ? [
                              {
                                label: "Move to tax invoice",
                                icon: (
                                  <ArrowRightLeft
                                    className={cls}
                                    aria-hidden="true"
                                  />
                                ),
                                onClick: () =>
                                  setTarget({ invoice: i, dialog: "tax" }),
                              },
                            ]
                          : []),
                        ...(canWrite && live && i.invoiceType === "PROFORMA"
                          ? [
                              {
                                label: "Mark as tax invoiced",
                                icon: (
                                  <FileCheck
                                    className={cls}
                                    aria-hidden="true"
                                  />
                                ),
                                onClick: () =>
                                  setTarget({ invoice: i, dialog: "markTax" }),
                              },
                            ]
                          : []),
                        ...(canWrite && !live
                          ? [
                              {
                                label: "Reopen",
                                icon: (
                                  <RotateCcw
                                    className={cls}
                                    aria-hidden="true"
                                  />
                                ),
                                onClick: () =>
                                  setTarget({ invoice: i, dialog: "reopen" }),
                              },
                            ]
                          : []),
                        ...(canChallan && i.invoiceType === "TAX"
                          ? [
                              {
                                label: "Create delivery challan",
                                icon: (
                                  <Truck className={cls} aria-hidden="true" />
                                ),
                                onClick: () =>
                                  setTarget({ invoice: i, dialog: "challan" }),
                              },
                            ]
                          : []),
                        ...(canWrite && live
                          ? [
                              {
                                label: "Edit invoice",
                                icon: (
                                  <Pencil className={cls} aria-hidden="true" />
                                ),
                                separator: true,
                                onClick: () =>
                                  router.push(`/sales/invoices/${i.id}/edit`),
                              },
                            ]
                          : []),
                        ...(canDelete && live
                          ? [
                              {
                                label: "Delete invoice",
                                icon: (
                                  <Trash2 className={cls} aria-hidden="true" />
                                ),
                                variant: "destructive" as const,
                                separator: !(canWrite && live),
                                onClick: () =>
                                  setTarget({ invoice: i, dialog: "delete" }),
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

      {current && canSend ? (
        <SendEmailDialog
          open={target?.dialog === "email"}
          onClose={closeDialog}
          path={`${INVOICES}/${current.id}/email`}
          documentLabel={`${INVOICE_LABEL[current.invoiceType]} ${current.invoiceNumber}`}
          customerEmail={current.customerSnapshot.email}
        />
      ) : null}
      {current && target?.dialog === "payment" ? (
        <PaymentFormDialog
          open
          onClose={closeDialog}
          invoice={{
            id: current.id,
            invoiceNumber: current.invoiceNumber,
            totalAmount: current.totalAmount,
            balance: current.balance,
            customerName: current.customerSnapshot.companyName,
          }}
        />
      ) : null}
      {current && target?.dialog === "tax" ? (
        <DateActionDialog
          open
          onClose={closeDialog}
          title={`Move ${current.invoiceNumber} to a tax invoice`}
          dateLabel="Tax invoice date"
          description="The tax invoice copies everything, and the payments move with it. The proforma is locked afterwards."
          confirmLabel="Move to tax invoice"
          onConfirm={async (date) => {
            const tax = await toTax.mutateAsync({
              id: current.id,
              invoiceDate: date,
            });
            toast({
              title: `Tax invoice ${tax.invoiceNumber} created`,
              variant: "success",
            });
            router.push(`/sales/invoices/${tax.id}`);
          }}
        />
      ) : null}
      {current && target?.dialog === "markTax" ? (
        <ConfirmDialog
          open
          onClose={closeDialog}
          onConfirm={async () => {
            try {
              await markTax.mutateAsync(current.id);
              toast({
                title: `${current.invoiceNumber} marked as tax invoiced`,
                variant: "success",
              });
            } catch (e) {
              toast({
                title:
                  e instanceof ApiError ? e.message : "Could not mark as done",
                variant: "error",
              });
            } finally {
              closeDialog();
            }
          }}
          title="Mark as tax invoiced"
          description={`${current.invoiceNumber} is locked as moved to a tax invoice, without creating one here. Use this when the tax invoice was raised outside the system.`}
          confirmText="Mark as tax invoiced"
          loading={markTax.isPending}
        />
      ) : null}
      {current && target?.dialog === "reopen" ? (
        <ReasonActionDialog
          open
          onClose={closeDialog}
          title="Reopen proforma invoice"
          description={`${current.invoiceNumber} becomes live again and can be edited, paid or moved to a tax invoice.`}
          reasonLabel="Reason for reopening"
          reasonHint="Recorded on the proforma and in its history."
          placeholder="e.g. Marked as tax invoiced by mistake"
          confirmLabel="Reopen"
          onConfirm={async (reason) => {
            await reopen.mutateAsync({ id: current.id, reason });
            toast({
              title: `${current.invoiceNumber} is open again`,
              variant: "success",
            });
            closeDialog();
          }}
        />
      ) : null}
      {current && target?.dialog === "challan" ? (
        <DateActionDialog
          open
          onClose={closeDialog}
          title={`Delivery challan for ${current.invoiceNumber}`}
          dateLabel="Challan date"
          description="The challan copies the customer and items, without prices."
          confirmLabel="Create delivery challan"
          onConfirm={async (date) => {
            const dc = await toChallan.mutateAsync({
              id: current.id,
              dcDate: date,
            });
            toast({
              title: `Delivery challan ${dc.dcNumber} created`,
              variant: "success",
            });
            router.push(`/sales/delivery-challans/${dc.id}`);
          }}
        />
      ) : null}
      {canDelete ? (
        <DeleteConfirmDialog
          open={target?.dialog === "delete"}
          onClose={closeDialog}
          onConfirm={handleDelete}
          title="Delete invoice"
          itemName={current?.invoiceNumber ?? ""}
          description="Invoices with payments or delivery challans cannot be deleted."
          loading={remove.isPending}
        />
      ) : null}
    </div>
  );
}
