"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Plus } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  ErrorState,
  PageHeader,
  SectionCard,
  SpringGlideSegmentedControl,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { SALES_PERMISSIONS } from "../../permissions";
import { salesTabHref } from "../../shared/tabs";
import { useSalesDashboard } from "../hooks";
import type { SalesDashboard } from "../types";
import { AttentionStrip } from "./AttentionStrip";
import { KpiRow } from "./KpiRow";
import { MonthlyChart } from "./MonthlyChart";
import { PipelinePanel } from "./PipelinePanel";
import { ReceivablesPanel } from "./ReceivablesPanel";
import { RecentActivityTable } from "./RecentActivityTable";
import { SalesChecklist } from "./SalesChecklist";
import { TopClientsPanel } from "./TopClientsPanel";

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

function Body({
  d,
  years,
  onYear,
}: {
  d: SalesDashboard;
  years: readonly { id: string; label: string }[];
  onYear: (year: number) => void;
}) {
  return (
    <>
      <AttentionStrip items={d.needsAttention} />
      <KpiRow d={d} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <SectionCard
          title="Revenue vs collections"
          description={`Monthly, ${d.year}`}
          className="xl:col-span-2"
        >
          <SpringGlideSegmentedControl
            ariaLabel="Year"
            size="sm"
            options={years}
            value={String(d.year)}
            onChange={(v) => onYear(Number(v))}
          />
          <MonthlyChart data={d.monthlyRevenueVsCollections} year={d.year} />
        </SectionCard>
        <ReceivablesPanel receivables={d.receivables} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <PipelinePanel d={d} />
        <TopClientsPanel clients={d.topClients} year={d.year} />
        <SalesChecklist />
      </div>

      <RecentActivityTable rows={d.recentActivity} />
    </>
  );
}

export function SalesDashboardView() {
  const router = useRouter();
  const canRead = usePermission(SALES_PERMISSIONS.dashboardRead);
  const canQuote = usePermission(SALES_PERMISSIONS.quotationWrite);
  const canInvoice = usePermission(SALES_PERMISSIONS.invoiceWrite);
  const canPay = usePermission(SALES_PERMISSIONS.invoicePaymentWrite);

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const years = [currentYear, currentYear - 1, currentYear - 2].map((y) => ({
    id: String(y),
    label: String(y),
  }));
  // The current year is the API default, so it needs no parameter.
  const query = useSalesDashboard(
    canRead,
    year === currentYear ? undefined : year,
  );

  if (!canRead) {
    return (
      <Alert
        dismissible
        variant="warning"
        title="You don't have access to the Sales dashboard"
      >
        Ask an administrator for the <code>sales.dashboard.read</code>{" "}
        permission.
      </Alert>
    );
  }

  const actions = (
    <div className="flex flex-wrap gap-2">
      {canQuote ? (
        <Button
          variant="secondary"
          onClick={() => router.push("/sales/quotations/new")}
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          New quotation
        </Button>
      ) : null}
      {canInvoice ? (
        <Button
          variant="secondary"
          onClick={() => router.push("/sales/invoices/new/tax")}
        >
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
          New tax invoice
        </Button>
      ) : null}
      {canPay ? (
        <Button
          variant="secondary"
          onClick={() => router.push(salesTabHref("payments"))}
        >
          Record payment
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        title="Sales dashboard"
        description="Revenue, receivables, pipeline and follow-ups."
        icon={LayoutDashboard}
        action={actions}
      />
      {query.isPending ? (
        <DashboardSkeleton />
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.isPermissionError ? (
          <Alert
            dismissible
            variant="warning"
            title="You don't have access to the Sales dashboard"
          >
            Your access has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void query.refetch()} />
        )
      ) : (
        <Body d={query.data} years={years} onYear={setYear} />
      )}
    </div>
  );
}
