"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  Download,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Truck,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  DeleteConfirmDialog,
  ErrorState,
  PageHeader,
  SectionCard,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { useNotify } from "@/hooks/useNotify";
import { usePermission } from "@/hooks/usePermission";
import { BackArrow } from "../../customers/components/CustomerFormView";
import { SALES_PERMISSIONS } from "../../permissions";
import { DateActionDialog } from "../../shared/components/DateActionDialog";
import { DocumentPdfPanel } from "../../shared/components/DocumentPdfPanel";
import { ReasonActionDialog } from "../../shared/components/ReasonActionDialog";
import { SendEmailDialog } from "../../shared/components/SendEmailDialog";
import { downloadPdf, pdfFileName, whatsappLink } from "../../shared/documents";
import { formatDate, formatInr } from "../../shared/format";
import { PaymentFormDialog } from "../../payments/components/PaymentFormDialog";
import { useDeletePayment } from "../../payments/hooks";
import { INVOICES } from "../api";
import {
  useConvertToTax,
  useCreateChallanFromInvoice,
  useDeleteInvoice,
  useInvoice,
  useReopenProforma,
} from "../hooks";
import { INVOICE_LABEL, type InvoicePayment } from "../types";
import { listPathOf } from "./InvoiceFormView";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-theme-sm">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-right text-gray-900 dark:text-white/90">{value}</dd>
    </div>
  );
}

type DialogKind =
  | "email"
  | "tax"
  | "reopen"
  | "challan"
  | "delete"
  | "payment"
  | { deletePayment: InvoicePayment };

export function InvoiceDetailView({ id }: { id: number }) {
  const router = useRouter();
  const { notify, notifyError } = useNotify();
  const canRead = usePermission(SALES_PERMISSIONS.invoiceRead);
  const canWrite = usePermission(SALES_PERMISSIONS.invoiceWrite);
  const canDelete = usePermission(SALES_PERMISSIONS.invoiceDelete);
  const canSend = usePermission(SALES_PERMISSIONS.invoiceSend);
  const canPay = usePermission(SALES_PERMISSIONS.invoicePaymentWrite);
  const canChallan = usePermission(SALES_PERMISSIONS.deliveryChallanWrite);
  const query = useInvoice(canRead ? id : null);
  const remove = useDeleteInvoice();
  const toTax = useConvertToTax();
  const reopen = useReopenProforma();
  const toChallan = useCreateChallanFromInvoice();
  const removePayment = useDeletePayment();
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [lockedNoticeOpen, setLockedNoticeOpen] = useState(true);
  const [busy, setBusy] = useState<"pdf" | "whatsapp" | null>(null);

  if (!canRead) {
    return (
      <Alert
        dismissible
        variant="warning"
        title="You don't have access to invoices"
      >
        Ask an administrator for the <code>sales.invoice.read</code> permission.
      </Alert>
    );
  }
  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return query.error instanceof ApiError && query.error.isNotFound ? (
      <Alert dismissible variant="warning" title="Invoice not found">
        It may have been deleted.
      </Alert>
    ) : (
      <ErrorState onRetry={() => void query.refetch()} />
    );
  }
  const inv = query.data;
  const label = INVOICE_LABEL[inv.invoiceType];
  const live = inv.status !== "CONVERTED";
  const hasBalance = Number(inv.balance) > 0;
  const base = `${INVOICES}/${inv.id}`;

  async function run(kind: "pdf" | "whatsapp") {
    setBusy(kind);
    try {
      if (kind === "pdf") {
        await downloadPdf(`${base}/pdf`, pdfFileName(inv.invoiceNumber));
      } else {
        window.open(
          await whatsappLink(`${base}/whatsapp`),
          "_blank",
          "noopener",
        );
      }
    } catch (e) {
      notifyError(e, "sales.document.actionFailed");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    try {
      await remove.mutateAsync(inv.id);
      notify("sales.document.deleted", { number: inv.invoiceNumber });
      router.push(listPathOf(inv.invoiceType));
    } catch (e) {
      setDialog(null);
      notifyError(e, "sales.document.deleteFailed");
    }
  }

  async function handleDeletePayment(p: InvoicePayment) {
    try {
      await removePayment.mutateAsync(p.id);
      notify("sales.document.deleted", { number: p.paymentNumber });
    } catch (e) {
      notifyError(e, "sales.document.deleteFailed");
    } finally {
      setDialog(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        title={inv.invoiceNumber}
        description={`${label} · ${inv.customerSnapshot.companyName} · ${formatDate(inv.invoiceDate)}`}
        icon={
          <BackArrow
            href={listPathOf(inv.invoiceType)}
            label={`Back to ${inv.invoiceType === "PROFORMA" ? "proforma" : "tax"} invoices`}
          />
        }
        badge={<InvoiceStatusBadge status={inv.status} />}
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={busy === "pdf"}
              onClick={() => void run("pdf")}
            >
              <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Download PDF
            </Button>
            {canSend ? (
              <>
                <Button variant="secondary" onClick={() => setDialog("email")}>
                  <Mail className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Email
                </Button>
                <Button
                  variant="secondary"
                  loading={busy === "whatsapp"}
                  onClick={() => void run("whatsapp")}
                >
                  <MessageCircle
                    className="mr-1.5 h-4 w-4"
                    aria-hidden="true"
                  />
                  WhatsApp
                </Button>
              </>
            ) : null}
            {canWrite && live ? (
              <Button
                variant="secondary"
                onClick={() => router.push(`/sales/invoices/${inv.id}/edit`)}
              >
                <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Edit
              </Button>
            ) : null}
            {canWrite && live && inv.invoiceType === "PROFORMA" ? (
              <Button onClick={() => setDialog("tax")}>
                <ArrowRightLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Move to tax invoice
              </Button>
            ) : null}
            {canWrite && !live ? (
              <Button variant="secondary" onClick={() => setDialog("reopen")}>
                <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Reopen
              </Button>
            ) : null}
            {canChallan && inv.invoiceType === "TAX" ? (
              <Button variant="secondary" onClick={() => setDialog("challan")}>
                <Truck className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Create delivery challan
              </Button>
            ) : null}
            {canDelete && live ? (
              <Button variant="destructive" onClick={() => setDialog("delete")}>
                <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Delete
              </Button>
            ) : null}
          </div>
        }
      />

      {!live && lockedNoticeOpen ? (
        <Alert
          variant="info"
          title="Moved to a tax invoice"
          onClose={() => setLockedNoticeOpen(false)}
        >
          This proforma is locked.{" "}
          {inv.convertedTo ? (
            <Link href={`/sales/invoices/${inv.convertedTo.id}`}>
              Open {inv.convertedTo.invoiceNumber}
            </Link>
          ) : null}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="flex flex-col gap-5">
          <SectionCard
            title="Summary"
            description={`${inv.lines.length} ${inv.lines.length === 1 ? "item" : "items"}`}
          >
            <dl className="flex flex-col gap-2.5">
              <Fact label="Customer" value={inv.customerSnapshot.companyName} />
              <Fact label="Due date" value={formatDate(inv.dueDate)} />
              <Fact label="Payment terms" value={inv.paymentTerms ?? "—"} />
              {inv.reopenReason ? (
                <Fact label="Reopened because" value={inv.reopenReason} />
              ) : null}
              {inv.sourceQuotation ? (
                <Fact
                  label="From quotation"
                  value={
                    <Link href={`/sales/quotations/${inv.sourceQuotation.id}`}>
                      {inv.sourceQuotation.quotationNumber}
                    </Link>
                  }
                />
              ) : null}
              {inv.sourceInvoice ? (
                <Fact
                  label="From proforma"
                  value={
                    <Link href={`/sales/invoices/${inv.sourceInvoice.id}`}>
                      {inv.sourceInvoice.invoiceNumber}
                    </Link>
                  }
                />
              ) : null}
            </dl>
            <hr className="border-gray-200 dark:border-gray-800" />
            <dl className="flex flex-col gap-2.5">
              <Fact
                label="Taxable amount"
                value={formatInr(inv.taxableAmount)}
              />
              {inv.taxMode === "INTRA" ? (
                <>
                  <Fact
                    label={`CGST @ ${Number(inv.cgstRate)}%`}
                    value={formatInr(inv.cgstAmount)}
                  />
                  <Fact
                    label={`SGST @ ${Number(inv.sgstRate)}%`}
                    value={formatInr(inv.sgstAmount)}
                  />
                </>
              ) : (
                <Fact
                  label={`IGST @ ${Number(inv.igstRate)}%`}
                  value={formatInr(inv.igstAmount)}
                />
              )}
            </dl>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-sky-50 px-4 py-3 dark:bg-sky-500/10">
              <span className="text-theme-sm font-semibold text-gray-700 dark:text-gray-300">
                Total
              </span>
              <span className="text-theme-xl font-bold text-brand-700 dark:text-sky-300">
                {formatInr(inv.totalAmount)}
              </span>
            </div>
            <dl className="flex flex-col gap-2.5">
              <Fact label="Received" value={formatInr(inv.amountReceived)} />
              <Fact
                label="Balance"
                value={<strong>{formatInr(inv.balance)}</strong>}
              />
            </dl>
          </SectionCard>

          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
                Payments
              </h2>
              {canPay && live && hasBalance ? (
                <Button size="sm" onClick={() => setDialog("payment")}>
                  <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                  Record payment
                </Button>
              ) : null}
            </div>
            {inv.payments.length === 0 ? (
              <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                No payments yet.
              </p>
            ) : (
              <DataTable<InvoicePayment>
                caption="Payments on this invoice"
                rows={inv.payments}
                getRowKey={(p) => String(p.id)}
                columns={[
                  {
                    header: "No",
                    cell: (p) => (
                      <span className="font-mono">{p.paymentNumber}</span>
                    ),
                  },
                  { header: "Date", cell: (p) => formatDate(p.paymentDate) },
                  { header: "Mode", cell: (p) => p.mode },
                  {
                    header: "Amount",
                    align: "right",
                    cell: (p) => formatInr(p.amount),
                  },
                  ...(canPay && live
                    ? [
                        {
                          header: "",
                          align: "right" as const,
                          cell: (p: InvoicePayment) => (
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={`Delete payment ${p.paymentNumber}`}
                              onClick={() => setDialog({ deletePayment: p })}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            )}
          </Card>
        </div>
        <div className="xl:col-span-2">
          <DocumentPdfPanel
            path={`${base}/pdf`}
            version={inv.updatedAt}
            title={`${label} ${inv.invoiceNumber}`}
          />
        </div>
      </div>

      {canSend ? (
        <SendEmailDialog
          open={dialog === "email"}
          onClose={() => setDialog(null)}
          path={`${base}/email`}
          documentLabel={`${label} ${inv.invoiceNumber}`}
          customerEmail={inv.customerSnapshot.email}
        />
      ) : null}
      {dialog === "tax" ? (
        <DateActionDialog
          open
          onClose={() => setDialog(null)}
          title={`Move ${inv.invoiceNumber} to a tax invoice`}
          dateLabel="Tax invoice date"
          description="The tax invoice copies everything, and the payments move with it. The proforma is locked afterwards."
          confirmLabel="Move to tax invoice"
          onConfirm={async (date) => {
            const tax = await toTax.mutateAsync({
              id: inv.id,
              invoiceDate: date,
            });
            notify("sales.document.created", {
              label: "Tax invoice",
              number: tax.invoiceNumber,
            });
            router.push(`/sales/invoices/${tax.id}`);
          }}
        />
      ) : null}
      {dialog === "reopen" ? (
        <ReasonActionDialog
          open
          onClose={() => setDialog(null)}
          title="Reopen proforma invoice"
          description={`${inv.invoiceNumber} becomes live again and can be edited or paid. The tax invoice already created from it is not changed.`}
          reasonLabel="Reason for reopening"
          reasonHint="Recorded on the proforma and in its history."
          placeholder="e.g. Customer asked for changes before billing"
          confirmLabel="Reopen"
          onConfirm={async (reason) => {
            await reopen.mutateAsync({ id: inv.id, reason });
            notify("sales.document.reopened", { number: inv.invoiceNumber });
            setDialog(null);
          }}
        />
      ) : null}
      {dialog === "challan" ? (
        <DateActionDialog
          open
          onClose={() => setDialog(null)}
          title={`Delivery challan for ${inv.invoiceNumber}`}
          dateLabel="Challan date"
          description="The challan copies the customer and items, without prices."
          confirmLabel="Create delivery challan"
          onConfirm={async (date) => {
            const dc = await toChallan.mutateAsync({
              id: inv.id,
              dcDate: date,
            });
            notify("sales.document.created", {
              label: "Delivery challan",
              number: dc.dcNumber,
            });
            router.push(`/sales/delivery-challans/${dc.id}`);
          }}
        />
      ) : null}
      {dialog === "payment" ? (
        <PaymentFormDialog
          open
          onClose={() => setDialog(null)}
          invoice={{
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            totalAmount: inv.totalAmount,
            balance: inv.balance,
            customerName: inv.customerSnapshot.companyName,
          }}
        />
      ) : null}
      {canDelete ? (
        <DeleteConfirmDialog
          open={dialog === "delete"}
          onClose={() => setDialog(null)}
          onConfirm={handleDelete}
          title="Delete invoice"
          itemName={inv.invoiceNumber}
          description="Invoices with payments or delivery challans cannot be deleted."
          loading={remove.isPending}
        />
      ) : null}
      {typeof dialog === "object" && dialog !== null ? (
        <DeleteConfirmDialog
          open
          onClose={() => setDialog(null)}
          onConfirm={() => handleDeletePayment(dialog.deletePayment)}
          title="Delete payment"
          itemName={dialog.deletePayment.paymentNumber}
          description="The balance goes back up. The number is not reused."
          loading={removePayment.isPending}
        />
      ) : null}
    </div>
  );
}
