"use client";

import Link from "next/link";
import {
  Banknote,
  FileText,
  IndianRupee,
  LayoutDashboard,
  Receipt,
  Users,
  Wallet,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Card,
  ErrorState,
  PageHeader,
  Skeleton,
  StatCard,
  StatusBadge,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { SALES_PERMISSIONS } from "../../permissions";
import { formatDate, formatInr, formatInrWhole } from "../../shared/format";
import { useSalesDashboard } from "../hooks";
import type { AttentionKind, SalesDashboard } from "../types";
import { MonthlyChart } from "./MonthlyChart";
import { SalesChecklist } from "./SalesChecklist";

const ATTENTION: Record<
  AttentionKind,
  { title: (n: number) => string; variant: "info" | "warning" | "error" }
> = {
  unpaid_invoices: {
    title: (n) => `${n} unpaid invoice${n === 1 ? "" : "s"}`,
    variant: "warning",
  },
  pending_quotations: {
    title: (n) => `${n} quotation${n === 1 ? "" : "s"} awaiting the customer`,
    variant: "info",
  },
  overdue_invoices: {
    title: (n) => `${n} invoice${n === 1 ? "" : "s"} unpaid for over 90 days`,
    variant: "error",
  },
  open_returnable_dcs: {
    title: (n) => `${n} returnable DC${n === 1 ? "" : "s"} not returned`,
    variant: "info",
  },
  overdue_follow_ups: {
    title: (n) => `${n} overdue follow-up${n === 1 ? "" : "s"}`,
    variant: "warning",
  },
};

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`flex flex-col gap-4 ${className ?? ""}`}>
      <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
        {title}
      </h2>
      {children}
    </Card>
  );
}

function Meter({ label, percent }: { label: string; percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-theme-sm">
        <span className="text-gray-600 dark:text-gray-300">{label}</span>
        <span className="font-semibold text-gray-900 dark:text-white/90">
          {percent}%
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
      >
        <div
          className="h-full rounded-full bg-brand-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

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

function Body({ d }: { d: SalesDashboard }) {
  const k = d.kpis;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          headingId="sales-kpi-revenue"
          label="Revenue this month"
          value={formatInrWhole(k.monthlyRevenue)}
          note="Tax invoices issued this month"
          tone="brand"
          icon={IndianRupee}
        />
        <StatCard
          headingId="sales-kpi-outstanding"
          label="Outstanding dues"
          value={formatInrWhole(k.outstandingDues)}
          note="Unpaid balance on tax invoices"
          tone="warning"
          icon={Wallet}
        />
        <StatCard
          headingId="sales-kpi-collected"
          label="Payments collected"
          value={formatInrWhole(k.paymentsCollected)}
          note={`${k.paymentsCount} payments`}
          tone="success"
          icon={Banknote}
        />
        <StatCard
          headingId="sales-kpi-customers"
          label="Active customers"
          value={k.activeCustomers}
          note={`${k.totalCustomers} in total`}
          tone="info"
          icon={Users}
          href="/sales/customers"
        />
        <StatCard
          headingId="sales-kpi-quotations"
          label="Quotations"
          value={k.totalQuotations}
          note={`${k.quotationsThisMonth} this month`}
          tone="neutral"
          icon={FileText}
        />
        <StatCard
          headingId="sales-kpi-invoices"
          label="Tax invoices"
          value={k.invoicesIssued}
          note={`${k.invoicesThisMonth} this month`}
          tone="neutral"
          icon={Receipt}
        />
      </div>

      {d.needsAttention.length > 0 ? (
        <div className="flex flex-col gap-2" aria-label="Needs attention">
          {d.needsAttention.map((a) => (
            <Alert
              key={a.kind}
              variant={ATTENTION[a.kind].variant}
              title={ATTENTION[a.kind].title(a.count)}
            >
              {a.amount ? `${formatInr(a.amount)} in total.` : null}
            </Alert>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel
          title={`Revenue vs collections, ${d.year}`}
          className="xl:col-span-2"
        >
          <MonthlyChart data={d.monthlyRevenueVsCollections} year={d.year} />
        </Panel>
        <Panel title="Pipeline">
          <div className="flex flex-col gap-4">
            <Meter
              label="Quotations turned into invoices"
              percent={d.pipeline.quotationToInvoicePercent}
            />
            <Meter
              label="Invoices with a payment"
              percent={d.pipeline.invoiceToPaymentPercent}
            />
            <Meter
              label="Quotation win rate"
              percent={d.pipeline.conversionPercent}
            />
            <dl className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 text-center dark:border-gray-800">
              {(
                [
                  ["Quotations", d.pipeline.quotations.value],
                  ["Billed", d.pipeline.invoices.value],
                  ["Collected", d.pipeline.payments.value],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-theme-xs text-gray-500 dark:text-gray-400">
                    {label}
                  </dt>
                  <dd className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                    {formatInrWhole(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel title="Receivables">
          <Meter
            label="Collected of billed"
            percent={d.receivables.collectedPercent}
          />
          <table className="w-full text-theme-sm">
            <caption className="sr-only">Outstanding by age</caption>
            <thead>
              <tr className="text-left text-theme-xs text-gray-500 dark:text-gray-400">
                <th scope="col" className="py-1.5 font-medium">
                  Age (days)
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Invoices
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {d.receivables.aging.map((b) => (
                <tr key={b.bucket}>
                  <th
                    scope="row"
                    className="py-1.5 text-left font-normal text-gray-700 dark:text-gray-300"
                  >
                    {b.bucket}
                  </th>
                  <td className="py-1.5 text-right">{b.count}</td>
                  <td className="py-1.5 text-right">{formatInr(b.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Top clients">
          {d.topClients.length === 0 ? (
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              No revenue yet this year.
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {d.topClients.map((c) => (
                <li
                  key={c.customerId}
                  className="flex items-center justify-between gap-2 text-theme-sm"
                >
                  <Link
                    href={`/sales/customers/${c.customerId}`}
                    className="truncate text-gray-900 hover:text-brand-600 dark:text-white/90 dark:hover:text-brand-400"
                  >
                    {c.rank}. {c.companyName}
                  </Link>
                  <span className="shrink-0 text-gray-600 dark:text-gray-300">
                    {formatInrWhole(c.revenue)} · {c.sharePercent}%
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <SalesChecklist />
      </div>

      <Panel title="Recent activity">
        {d.recentActivity.length === 0 ? (
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            No documents yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-theme-sm">
              <caption className="sr-only">Recent documents</caption>
              <thead>
                <tr className="text-left text-theme-xs text-gray-500 dark:text-gray-400">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Document
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Customer
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Date
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Status
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {d.recentActivity.map((a) => (
                  <tr key={`${a.documentType}-${a.documentNumber}`}>
                    <td className="py-2 pr-4">
                      <span className="font-mono text-gray-900 dark:text-white/90">
                        {a.documentNumber}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
                      {a.customerName}
                    </td>
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
                      {formatDate(a.date)}
                    </td>
                    <td className="py-2 pr-4">
                      <StatusBadge label={a.status} colorToken="gray" />
                    </td>
                    <td className="py-2 text-right text-gray-900 dark:text-white/90">
                      {formatInr(a.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

export function SalesDashboardView() {
  const canRead = usePermission(SALES_PERMISSIONS.dashboardRead);
  const query = useSalesDashboard(canRead);

  if (!canRead) {
    return (
      <Alert
        variant="warning"
        title="You don't have access to the Sales dashboard"
      >
        Ask an administrator for the <code>sales.dashboard.read</code>{" "}
        permission.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        variant="banner"
        title="Sales dashboard"
        description="Revenue, receivables, pipeline and follow-ups."
        icon={LayoutDashboard}
        badge={
          query.data ? (
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
              {query.data.year}
            </span>
          ) : undefined
        }
      />
      {query.isPending ? (
        <DashboardSkeleton />
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.isPermissionError ? (
          <Alert
            variant="warning"
            title="You don't have access to the Sales dashboard"
          >
            Your access has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void query.refetch()} />
        )
      ) : (
        <Body d={query.data} />
      )}
    </div>
  );
}
