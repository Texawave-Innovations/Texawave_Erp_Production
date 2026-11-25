"use client";

import { salesTabHref } from "@/features/sales/shared/tabs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "@texawave-erp/core";
import { Alert, ErrorState, PageHeader, Skeleton } from "@texawave-erp/ui-kit";
import { useNotify } from "@/hooks/useNotify";
import { usePermission } from "@/hooks/usePermission";
import { BackArrow } from "../../customers/components/CustomerFormView";
import { SALES_PERMISSIONS } from "../../permissions";
import { todayIst } from "../../shared/format";
import { useCreateQuotation, useQuotation, useUpdateQuotation } from "../hooks";
import { emptyQuotationForm, quotationToForm } from "../schema";
import type { QuotationBody } from "../types";
import { QuotationForm } from "./QuotationForm";

function NoWriteAccess() {
  return (
    <Alert
      dismissible
      variant="warning"
      title="You don't have access to change quotations"
    >
      Ask an administrator for the <code>sales.quotation.write</code>{" "}
      permission.
    </Alert>
  );
}

export function QuotationCreateView() {
  const router = useRouter();
  const { notify } = useNotify();
  const canWrite = usePermission(SALES_PERMISSIONS.quotationWrite);
  const create = useCreateQuotation();

  if (!canWrite) return <NoWriteAccess />;

  async function handleSubmit(body: QuotationBody) {
    const created = await create.mutateAsync(body);
    notify("sales.document.saved", {
      label: "Quotation",
      number: created.quotationNumber,
    });
    router.push(`/sales/quotations/${created.id}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        title="New quotation"
        description="Taxes and totals are worked out by the server as you type."
        icon={
          <BackArrow
            href={salesTabHref("quotations")}
            label="Back to quotations"
          />
        }
      />
      <QuotationForm
        mode="create"
        initialValues={emptyQuotationForm(todayIst())}
        onSubmit={handleSubmit}
        onCancel={() => router.push(salesTabHref("quotations"))}
      />
    </div>
  );
}

export function QuotationEditView({ id }: { id: number }) {
  const router = useRouter();
  const { notify } = useNotify();
  const canWrite = usePermission(SALES_PERMISSIONS.quotationWrite);
  const query = useQuotation(id);
  const update = useUpdateQuotation();

  if (!canWrite) return <NoWriteAccess />;
  if (query.isPending) return <Skeleton className="h-96 w-full" />;
  if (query.isError) {
    return query.error instanceof ApiError && query.error.isNotFound ? (
      <Alert dismissible variant="warning" title="Quotation not found">
        It may have been deleted.{" "}
        <Link href={salesTabHref("quotations")}>Back to quotations</Link>
      </Alert>
    ) : (
      <ErrorState onRetry={() => void query.refetch()} />
    );
  }
  const q = query.data;
  if (q.status === "CONVERTED") {
    return (
      <Alert
        dismissible
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
    notify("sales.document.saved", {
      label: "Quotation",
      number: q.quotationNumber,
    });
    router.push(`/sales/quotations/${id}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        title={`Edit ${q.quotationNumber}`}
        description={q.customerSnapshot.companyName}
        icon={
          <BackArrow
            href={`/sales/quotations/${id}`}
            label="Back to quotation"
          />
        }
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
