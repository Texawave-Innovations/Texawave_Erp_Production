import { Banknote, IndianRupee, Users, Wallet } from "lucide-react";
import { StatCard, type MetricTrendProps } from "@texawave-erp/ui-kit";
import { formatInrWhole } from "../../shared/format";
import { salesTabHref } from "../../shared/tabs";
import type { SalesDashboard } from "../types";

/** This month's revenue against last month's, from the monthly series. Only
 * for the current year, and only when last month had revenue to compare. */
function revenueTrend(d: SalesDashboard): MetricTrendProps | undefined {
  const now = new Date();
  const month = now.getMonth() + 1;
  if (d.year !== now.getFullYear() || month < 2) return undefined;
  const revenueOf = (m: number) =>
    Number(d.monthlyRevenueVsCollections.find((p) => p.month === m)?.revenue);
  const previous = revenueOf(month - 1);
  if (!Number.isFinite(previous) || previous <= 0) return undefined;
  const change = Math.round(((revenueOf(month) - previous) / previous) * 100);
  return {
    value: `${Math.abs(change)}%`,
    direction: change > 0 ? "up" : change < 0 ? "down" : "neutral",
    label: "vs last month",
  };
}

export function KpiRow({ d }: { d: SalesDashboard }) {
  const k = d.kpis;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        variant="kpi"
        headingId="sales-kpi-revenue"
        label="Revenue this month"
        value={formatInrWhole(k.monthlyRevenue)}
        note={`${k.invoicesThisMonth} tax invoices issued`}
        tone="brand"
        icon={IndianRupee}
        trend={revenueTrend(d)}
        href={salesTabHref("tax-invoices")}
      />
      <StatCard
        variant="kpi"
        headingId="sales-kpi-outstanding"
        label="Outstanding dues"
        value={formatInrWhole(k.outstandingDues)}
        note="Unpaid balance on tax invoices"
        tone="warning"
        icon={Wallet}
        href={salesTabHref("tax-invoices")}
      />
      <StatCard
        variant="kpi"
        headingId="sales-kpi-collected"
        label="Payments collected"
        value={formatInrWhole(k.paymentsCollected)}
        note={`${k.paymentsCount} payments`}
        tone="success"
        icon={Banknote}
        href={salesTabHref("payments")}
      />
      <StatCard
        variant="kpi"
        headingId="sales-kpi-customers"
        label="Active customers"
        value={k.activeCustomers}
        note={`${k.totalCustomers} in total`}
        tone="info"
        icon={Users}
        href={salesTabHref("customers")}
      />
    </div>
  );
}
