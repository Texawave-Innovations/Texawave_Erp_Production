"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
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
import { todayIst } from "../../shared/format";
import { useCreateQuotation, useQuotation, useUpdateQuotation } from "../hooks";
import { emptyQuotationForm, quotationToForm } from "../schema";
import type { QuotationBody } from "../types";
import { QuotationForm } from "./QuotationForm";

function NoWriteAccess() {
  return (
    <Alert variant="warning" title="You don't have access to change quotations">
      Ask an administrator for the <code>sales.quotation.write</code>{" "}
      permission.
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

export function QuotationCreateView() {
  const router = useRouter();
  const { toast } = useToast();
  const canWrite = usePermission(SALES_PERMISSIONS.quotationWrite);
  const create = useCreateQuotation();

  if (!canWrite) return <NoWriteAccess />;

  async function handleSubmit(body: QuotationBody) {
    const created = await create.mutateAsync(body);
    toast({
      title: `Quotation ${created.quotationNumber} saved`,
      variant: "success",
    });
    router.push(`/sales/quotations/${created.id}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/sales/quotations" label="Back to quotations" />
      <PageHeader
        variant="banner"
        title="New quotation"
        description="Taxes and totals are worked out by the server as you type."
        icon={FileText}
      />
      <QuotationForm
        mode="create"
        initialValues={emptyQuotationForm(todayIst())}
        onSubmit={handleSubmit}
        onCancel={() => router.push("/sales/quotations")}
      />
    </div>
  );
}

export function QuotationEditView({ id }: { id: number }) {
  const router = useRouter();
  const { toast } = useToast();
  const canWrite = usePermission(SALES_PERMISSIONS.quotationWrite);
  const query = useQuotation(id);
  const update = useUpdateQuotation();

  if (!canWrite) return <NoWriteAccess />;
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
  if (q.status === "CONVERTED") {
    return (
      <Alert
        variant="info"
        title={`${q.quotationNumber} can no longer be edited`}
      >
        It has been converted to an invoice.{" "}
        <Link href={`/sales/quotations/${q.id}`}>Back to the quotation</Link>
      </Alert>
    );
  }

  async function handleSubmit(body: QuotationBody) {
    await update.mutateAsync({ id, body });
    toast({
      title: `Quotation ${q.quotationNumber} saved`,
      variant: "success",
    });
    router.push(`/sales/quotations/${id}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <BackLink href={`/sales/quotations/${id}`} label="Back to quotation" />
      <PageHeader
        variant="banner"
        title={`Edit ${q.quotationNumber}`}
        description={q.customerSnapshot.companyName}
        icon={FileText}
      />
      <QuotationForm
        key={q.updatedAt}
        mode="edit"
        quotationId={q.id}
        quotationNumber={q.quotationNumber}
        initialValues={quotationToForm(q)}
        savedBank={q.bankDetails}
        customerLabel={`${q.customerSnapshot.customerCode} — ${q.customerSnapshot.companyName}`}
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/sales/quotations/${id}`)}
      />
    </div>
  );
}
