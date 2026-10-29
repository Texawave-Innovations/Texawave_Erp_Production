"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  Download,
  FileText,
  Mail,
  MessageCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DeleteConfirmDialog,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { SALES_PERMISSIONS } from "../../permissions";
import { DocumentPdfPanel } from "../../shared/components/DocumentPdfPanel";
import { SendEmailDialog } from "../../shared/components/SendEmailDialog";
import { downloadPdf, pdfFileName, whatsappLink } from "../../shared/documents";
import { formatDate, formatInr } from "../../shared/format";
import { QUOTATIONS } from "../api";
import { useDeleteQuotation, useQuotation } from "../hooks";
import { ConvertQuotationDialog } from "./ConvertQuotationDialog";

export function QuotationStatusBadge({ status }: { status: string }) {
  return status === "CONVERTED" ? (
    <StatusBadge label="Converted" colorToken="success" />
  ) : (
    <StatusBadge label="Open" colorToken="brand" />
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-theme-sm">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-right text-gray-900 dark:text-white/90">{value}</dd>
    </div>
  );
}

export function QuotationDetailView({ id }: { id: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const canRead = usePermission(SALES_PERMISSIONS.quotationRead);
  const canWrite = usePermission(SALES_PERMISSIONS.quotationWrite);
  const canDelete = usePermission(SALES_PERMISSIONS.quotationDelete);
  const canSend = usePermission(SALES_PERMISSIONS.quotationSend);
  const canConvert = usePermission(SALES_PERMISSIONS.invoiceWrite);
  const query = useQuotation(canRead ? id : null);
  const remove = useDeleteQuotation();
  const [dialog, setDialog] = useState<"email" | "convert" | "delete" | null>(
    null,
  );
  const [busy, setBusy] = useState<"pdf" | "whatsapp" | null>(null);

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to quotations">
        Ask an administrator for the <code>sales.quotation.read</code>{" "}
        permission.
      </Alert>
    );
  }
  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return query.error instanceof ApiError && query.error.isNotFound ? (
      <Alert variant="warning" title="Quotation not found">
        It may have been deleted.{" "}
        <Link href="/sales/quotations">Back to quotations</Link>
      </Alert>
    ) : (
      <ErrorState onRetry={() => void query.refetch()} />
    );
  }
  const q = query.data;
  const open = q.status === "OPEN";
  const base = `${QUOTATIONS}/${q.id}`;

  async function run(kind: "pdf" | "whatsapp") {
    setBusy(kind);
    try {
      if (kind === "pdf") {
        await downloadPdf(`${base}/pdf`, pdfFileName(q.quotationNumber));
      } else {
        window.open(
          await whatsappLink(`${base}/whatsapp`),
          "_blank",
          "noopener",
        );
      }
    } catch (e) {
      toast({
        title:
          e instanceof ApiError
            ? e.message
            : kind === "pdf"
              ? "Could not download the PDF"
              : "Could not open WhatsApp",
        variant: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    try {
      await remove.mutateAsync(q.id);
      toast({ title: `${q.quotationNumber} deleted`, variant: "success" });
      router.push("/sales/quotations");
    } catch (e) {
      setDialog(null);
      toast({
        title: e instanceof ApiError ? e.message : "Could not delete",
        variant: "error",
      });
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/sales/quotations"
        className="text-theme-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        ← Back to quotations
      </Link>
      <PageHeader
        variant="banner"
        title={q.quotationNumber}
        description={`${q.customerSnapshot.companyName} · ${formatDate(q.quotationDate)}`}
        icon={FileText}
        badge={<QuotationStatusBadge status={q.status} />}
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
            {canWrite && open ? (
              <Button
                variant="secondary"
                onClick={() => router.push(`/sales/quotations/${q.id}/edit`)}
              >
                <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Edit
              </Button>
            ) : null}
            {canConvert && open ? (
              <Button onClick={() => setDialog("convert")}>
                <ArrowRightLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Convert to invoice
              </Button>
            ) : null}
            {canDelete && open ? (
              <Button variant="destructive" onClick={() => setDialog("delete")}>
                <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                Delete
              </Button>
            ) : null}
          </div>
        }
      />

      {!open ? (
        <Alert variant="info" title="Converted to an invoice">
          This quotation is locked
          {q.convertedAt ? ` since ${formatDate(q.convertedAt)}` : ""}.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="flex flex-col gap-3 xl:col-span-1">
          <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
            Summary
          </h2>
          <dl className="flex flex-col gap-2">
            <Fact label="Customer" value={q.customerSnapshot.companyName} />
            <Fact label="Validity" value={q.validity ?? "—"} />
            <Fact label="Delivery" value={q.deliveryTerms ?? "—"} />
            <Fact label="Items" value={q.lines.length} />
            <Fact label="Taxable amount" value={formatInr(q.taxableAmount)} />
            {q.taxMode === "INTRA" ? (
              <>
                <Fact
                  label={`CGST @ ${Number(q.cgstRate)}%`}
                  value={formatInr(q.cgstAmount)}
                />
                <Fact
                  label={`SGST @ ${Number(q.sgstRate)}%`}
                  value={formatInr(q.sgstAmount)}
                />
              </>
            ) : (
              <Fact
                label={`IGST @ ${Number(q.igstRate)}%`}
                value={formatInr(q.igstAmount)}
              />
            )}
            <Fact
              label="Total"
              value={<strong>{formatInr(q.totalAmount)}</strong>}
            />
            <Fact label="Prepared by" value={q.preparedBy ?? "—"} />
          </dl>
        </Card>
        <div className="xl:col-span-2">
          <DocumentPdfPanel
            path={`${base}/pdf`}
            version={q.updatedAt}
            title={`Quotation ${q.quotationNumber}`}
          />
        </div>
      </div>

      {canSend ? (
        <SendEmailDialog
          open={dialog === "email"}
          onClose={() => setDialog(null)}
          path={`${base}/email`}
          documentLabel={`Quotation ${q.quotationNumber}`}
          customerEmail={q.customerSnapshot.email}
        />
      ) : null}
      {canConvert && open ? (
        <ConvertQuotationDialog
          open={dialog === "convert"}
          onClose={() => setDialog(null)}
          quotationId={q.id}
          quotationNumber={q.quotationNumber}
        />
      ) : null}
      {canDelete ? (
        <DeleteConfirmDialog
          open={dialog === "delete"}
          onClose={() => setDialog(null)}
          onConfirm={handleDelete}
          title="Delete quotation"
          itemName={q.quotationNumber}
          description="Its number stays used; the next quotation gets the next number."
          loading={remove.isPending}
        />
      ) : null}
    </div>
  );
}
