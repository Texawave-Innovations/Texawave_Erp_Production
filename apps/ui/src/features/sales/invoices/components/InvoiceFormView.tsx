"use client";

import { useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Receipt } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  ErrorState,
  PageHeader,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { SALES_PERMISSIONS } from "../../permissions";
import { PricedDocumentForm } from "../../shared/components/PricedDocumentForm";
import type { BankDetails } from "../../shared/documents";
import { todayIst } from "../../shared/format";
import { previewInvoice } from "../api";
import { useCreateInvoice, useInvoice, useUpdateInvoice } from "../hooks";
import {
  emptyInvoiceForm,
  formToCreateBody,
  formToUpdateBody,
  INVOICE_FORM,
  invoiceSchema,
  invoiceToForm,
  type InvoiceFormValues,
} from "../schema";
import { INVOICE_LABEL, type InvoiceType } from "../types";

type Bank = (choice: string) => BankDetails | null;

export const listPathOf = (t: InvoiceType) =>
  t === "PROFORMA" ? "/sales/proforma-invoices" : "/sales/tax-invoices";

function NoWriteAccess() {
  return (
    <Alert variant="warning" title="You don't have access to change invoices">
      Ask an administrator for the <code>sales.invoice.write</code> permission.
    </Alert>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="text-theme-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
    >
      ← {label}
    </Link>
  );
}

export function InvoiceCreateView({
  invoiceType,
}: {
  invoiceType: InvoiceType;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const canWrite = usePermission(SALES_PERMISSIONS.invoiceWrite);
  const create = useCreateInvoice();
  const preview = useCallback(
    (v: InvoiceFormValues, bank: Bank) =>
      previewInvoice(formToCreateBody(v, bank)),
    [],
  );

  if (!canWrite) return <NoWriteAccess />;

  return (
    <div className="flex flex-col gap-5">
      <BackLink href={listPathOf(invoiceType)} label="Back to invoices" />
      <PageHeader
        variant="banner"
        title={`New ${INVOICE_LABEL[invoiceType].toLowerCase()}`}
        description="Taxes and totals are worked out by the server as you type."
        icon={Receipt}
      />
      <PricedDocumentForm
        config={INVOICE_FORM}
        schema={invoiceSchema}
        mode="create"
        initialValues={emptyInvoiceForm(invoiceType, todayIst())}
        preview={preview}
        onSubmit={async (v, bank) => {
          const created = await create.mutateAsync(formToCreateBody(v, bank));
          toast({
            title: `${INVOICE_LABEL[created.invoiceType]} ${created.invoiceNumber} saved`,
            variant: "success",
          });
          router.push(`/sales/invoices/${created.id}`);
        }}
        onCancel={() => router.push(listPathOf(invoiceType))}
        submitLabel="Save invoice"
      />
    </div>
  );
}

export function InvoiceEditView({ id }: { id: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const canWrite = usePermission(SALES_PERMISSIONS.invoiceWrite);
  const query = useInvoice(id);
  const update = useUpdateInvoice();
  const preview = useCallback(
    (v: InvoiceFormValues, bank: Bank) =>
      previewInvoice(formToUpdateBody(v, bank), id),
    [id],
  );

  if (!canWrite) return <NoWriteAccess />;
  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return query.error instanceof ApiError && query.error.isNotFound ? (
      <Alert variant="warning" title="Invoice not found">
        It may have been deleted.
      </Alert>
    ) : (
      <ErrorState onRetry={() => void query.refetch()} />
    );
  }
  const inv = query.data;
  if (inv.status === "CONVERTED") {
    return (
      <Alert
        variant="info"
        title={`${inv.invoiceNumber} can no longer be edited`}
      >
        It has been moved to a tax invoice.{" "}
        <Link href={`/sales/invoices/${inv.id}`}>Back to the invoice</Link>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/sales/invoices/${id}`} label="Back to invoice" />
      <PageHeader
        variant="banner"
        title={`Edit ${inv.invoiceNumber}`}
        description={inv.customerSnapshot.companyName}
        icon={Receipt}
      />
      {Number(inv.amountReceived) > 0 ? (
        <Alert variant="info" title="Payments already received">
          The total cannot go below {inv.amountReceived} already received.
        </Alert>
      ) : null}
      <PricedDocumentForm
        key={inv.updatedAt}
        config={INVOICE_FORM}
        schema={invoiceSchema}
        mode="edit"
        documentNumber={inv.invoiceNumber}
        initialValues={invoiceToForm(inv)}
        savedBank={inv.bankDetails}
        customerLabel={`${inv.customerSnapshot.customerCode} — ${inv.customerSnapshot.companyName}`}
        preview={preview}
        onSubmit={async (v, bank) => {
          await update.mutateAsync({ id, body: formToUpdateBody(v, bank) });
          toast({ title: `${inv.invoiceNumber} saved`, variant: "success" });
          router.push(`/sales/invoices/${id}`);
        }}
        onCancel={() => router.push(`/sales/invoices/${id}`)}
        submitLabel="Save changes"
      />
    </div>
  );
}
