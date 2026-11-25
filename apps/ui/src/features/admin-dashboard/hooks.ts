"use client";

import { useQuery } from "@tanstack/react-query";
import { orgScopedKey } from "@texawave-erp/core";
import type {
  ControlTowerException,
  CrmDashboard,
  ProcurementDashboardSummary,
  ScmOverview,
  StockMovementTrendDay,
  SupplierBill,
} from "@texawave-erp/api-types";
import { useAuthStore } from "@/stores/auth-store";
import { getCrmDashboard } from "@/features/crm/dashboard/api";
import {
  getBalanceSheet,
  getMonthlyTrend,
  getProfitAndLoss,
} from "@/features/finance/reports/api";
import { getDashboardMetrics, getHoursTrend } from "@/features/projects/api";
import { useSalesDashboard } from "@/features/sales/dashboard/hooks";
import { scmGet, scmList } from "@/features/scm/shared/scm-api";
import { useScmData } from "@/features/scm/shared/scm-hooks";
import {
  useApprovalsPending,
  useDailyAttendance,
  useHeadcount,
  useOpenTasks,
  useWeekAttendance,
} from "@/features/hr/dashboard/hooks";
import { formatValue, num, pct, toPart } from "./format";
import type {
  CoreView,
  ChartBar,
  ItemTone,
  Kpi,
  ListItem,
  Part,
} from "./types";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function shortDate(date: string): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** First letters of each word, or the first four letters of a single word. */
function abbreviate(value: string): string {
  const words = titleCase(value).split(" ");
  if (words.length === 1) return (words[0] ?? "").slice(0, 4);
  return words
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 4)
    .toUpperCase();
}

/** Combines several queries into one widget part: loading/error if any source is. */
function combine<T>(
  parts: ReadonlyArray<Pick<Part<unknown>, "loading" | "error" | "retry">>,
  ready: boolean,
  build: () => T,
): Part<T> {
  return {
    data: ready ? build() : null,
    loading: parts.some((p) => p.loading),
    error: parts.length > 0 && parts.every((p) => p.error),
    retry: () => parts.forEach((p) => p.retry()),
  };
}

function qp(q: {
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
}) {
  return {
    loading: q.isLoading,
    error: q.isError,
    retry: () => void q.refetch(),
  };
}

// ── HR ──────────────────────────────────────────────────────────────────────

export interface HrAccess {
  employees: boolean;
  attendance: boolean;
  approvals: boolean;
  tasks: boolean;
}

const PRIORITY_TONE: Record<string, ItemTone> = {
  URGENT: "error",
  HIGH: "warning",
  MEDIUM: "brand",
  LOW: "slate",
};

export function useHrView(
  active: boolean,
  access: HrAccess,
  today: string,
): CoreView {
  const headcount = useHeadcount(active && access.employees);
  const attendance = useDailyAttendance(today, active && access.attendance);
  const approvals = useApprovalsPending(active && access.approvals);
  const week = useWeekAttendance(today, active && access.attendance);
  const tasks = useOpenTasks(active && access.tasks);

  const kpiSources = [
    access.employees ? qp(headcount) : null,
    access.attendance ? qp(attendance) : null,
    access.approvals ? qp(approvals) : null,
  ].filter((p): p is NonNullable<typeof p> => p !== null);

  const kpisReady =
    active && kpiSources.length > 0 && kpiSources.every((p) => !p.loading);
  const kpis = combine<Kpi[]>(kpiSources, kpisReady, () => {
    const h = headcount.data;
    const c = attendance.data?.counts;
    const scoped = attendance.data?.rows.length ?? 0;
    const a = approvals.data;
    return [
      {
        id: "employees",
        label: "Total Employees",
        value: h?.total ?? null,
        format: "number",
        note: h
          ? h.newJoinersThisMonth > 0
            ? `${h.newJoinersThisMonth} joined this month`
            : `${h.active} active in workforce`
          : "Employee access needed",
        direction: h && h.newJoinersThisMonth > 0 ? "up" : "flat",
        href: "/hr/employees",
      },
      {
        id: "present",
        label: "Present Today",
        value: c?.present ?? null,
        format: "number",
        note: c
          ? `${pct(c.present, scoped)}% attendance rate`
          : "Attendance access needed",
        direction: "up",
        href: "/hr/attendance",
      },
      {
        id: "leave",
        label: "On Leave",
        value: c?.onLeave ?? null,
        format: "number",
        note: c ? `${c.absent} absent today` : "Attendance access needed",
        direction: c && c.absent > 0 ? "down" : "flat",
        href: "/hr/leaves",
      },
      {
        id: "approvals",
        label: "Pending Approvals",
        value: a?.total ?? null,
        format: "number",
        note: a
          ? `${a.leaves} leave · ${a.corrections} regularization`
          : "Approval access needed",
        direction: a && a.total > 0 ? "down" : "flat",
        href: "/hr/leaves",
      },
    ];
  });

  const chart = combine(
    [{ loading: week.isLoading, error: week.isError, retry: week.refetch }],
    active && access.attendance && week.hasData,
    () => ({
      format: "number" as const,
      focusIndex: week.days.length - 1,
      bars: week.days.map((d): ChartBar => {
        const date = new Date(`${d.date}T00:00:00Z`);
        const weekday = date.toLocaleDateString("en-IN", {
          weekday: "short",
          timeZone: "UTC",
        });
        return {
          label: weekday.slice(0, 3),
          full: `${weekday}, ${shortDate(d.date)} · ${pct(d.present, d.total)}% of ${d.total}`,
          value: d.present,
          muted: d.present === 0,
          href: "/hr/attendance",
        };
      }),
    }),
  );

  const gauge = toPart(attendance, (d) => {
    const workable = d.rows.filter(
      (r) => r.status !== "HOLIDAY" && r.status !== "WEEKLY_OFF",
    ).length;
    const rest = Math.max(0, workable - d.counts.present - d.counts.onLeave);
    return {
      percent: pct(d.counts.present, workable),
      caption: "Present",
      segments: [
        { label: "Present", value: d.counts.present, kind: "solid" as const },
        { label: "On leave", value: d.counts.onLeave, kind: "dark" as const },
        { label: "Absent / unmarked", value: rest, kind: "striped" as const },
      ],
    };
  });

  const list = toPart(tasks, (rows): ListItem[] =>
    rows.map((t) => ({
      id: `task-${t.id}`,
      title: t.title,
      meta: `Due ${shortDate(t.dueDate)} · ${t.assignee.fullName}`,
      href: "/hr/tasks",
      tone: t.isOverdue ? "error" : (PRIORITY_TONE[t.priority] ?? "brand"),
      badge: t.isOverdue ? "Overdue" : titleCase(t.priority),
    })),
  );

  return { kpis, chart, gauge, list };
}

// ── SCM & Purchases (one overview endpoint feeds both) ───────────────────────

function useScmOverviewWhen(enabled: boolean) {
  // Same resource/key as `useScmOverview`, so the SCM page and this share a cache entry.
  return useScmData<ScmOverview>(
    "overview",
    ["overview"],
    () => scmGet("/scm/overview"),
    enabled,
  );
}

const SEVERITY_TONE: Record<string, ItemTone> = {
  HIGH: "error",
  MEDIUM: "warning",
  LOW: "sky",
};

export function useScmView(active: boolean): CoreView {
  const overview = useScmOverviewWhen(active);
  const movement = useScmData<StockMovementTrendDay[]>(
    "overview",
    ["movement-trend", 7],
    () => scmGet("/scm/overview/movement-trend", { days: 7 }),
    active,
  );
  const tower = useScmData<ControlTowerException[]>(
    "overview",
    ["control-tower"],
    () => scmGet("/scm/advanced/control-tower"),
    active,
  );

  const kpis = toPart(overview, ({ metrics: m }): Kpi[] => [
    {
      id: "inventory-value",
      label: "Inventory Value",
      value: m.inventoryValue,
      format: "currency",
      note: `${m.costedRows} costed stock rows`,
      direction: "up",
      href: "/scm/inventory/overview",
    },
    {
      id: "units",
      label: "Units Available",
      value: m.unitsAvailable,
      format: "number",
      note: `Across ${m.stockRows} stock rows`,
      direction: "flat",
      href: "/scm/inventory/overview",
    },
    {
      id: "low-stock",
      label: "Low Stock Items",
      value: m.lowStockItems,
      format: "number",
      note:
        m.lowStockItems > 0 ? "Below reorder level" : "All above reorder level",
      direction: m.lowStockItems > 0 ? "down" : "flat",
      href: "/scm/advanced/replenishment",
    },
    {
      id: "shipments",
      label: "Open Shipments",
      value: m.openShipments,
      format: "number",
      note: `${m.openSalesOrders} open sales orders`,
      direction: "flat",
      href: "/scm/logistics",
    },
  ]);

  const chart = toPart(movement, (days) => ({
    format: "number" as const,
    focusIndex: days.length - 1,
    bars: days.map((d): ChartBar => {
      const weekday = new Date(`${d.date}T00:00:00Z`).toLocaleDateString(
        "en-IN",
        { weekday: "short", timeZone: "UTC" },
      );
      const moved = d.inbound + d.outbound;
      return {
        label: weekday.slice(0, 3),
        full: `${weekday}, ${shortDate(d.date)}: ${d.inbound.toLocaleString("en-IN")} in · ${d.outbound.toLocaleString("en-IN")} out`,
        value: moved,
        muted: moved === 0,
        href: "/scm/inventory/overview",
      };
    }),
  }));

  const gauge = toPart(overview, ({ metrics: m }) => {
    const healthy = Math.max(0, m.stockRows - m.lowStockItems);
    return {
      percent: pct(healthy, m.stockRows),
      caption: "Above reorder level",
      segments: [
        { label: "Healthy", value: healthy, kind: "solid" as const },
        { label: "Low stock", value: m.lowStockItems, kind: "dark" as const },
      ],
    };
  });

  const list = toPart(tower, (rows): ListItem[] =>
    rows.slice(0, 5).map((e, i) => ({
      id: `exception-${i}-${e.type}`,
      title: e.title,
      meta: e.detail,
      href: e.path,
      tone: SEVERITY_TONE[e.severity] ?? "slate",
      badge: titleCase(e.severity),
    })),
  );

  return { kpis, chart, gauge, list };
}

export function usePurchasesView(
  active: boolean,
  access: { procurement: boolean },
): CoreView {
  const overview = useScmOverviewWhen(active);
  // Same resource/key as `useProcurementDashboard` (and usePurchasesExtras).
  const summary = useScmData<ProcurementDashboardSummary>(
    "procurement",
    ["dashboard"],
    () => scmGet("/scm/procurement/dashboard"),
    active && access.procurement,
  );

  const kpis = toPart(overview, ({ metrics: m }): Kpi[] => [
    {
      id: "suppliers",
      label: "Active Suppliers",
      value: m.activeSuppliers,
      format: "number",
      note: "Approved to supply",
      direction: "flat",
      href: "/purchases?tab=vendors",
    },
    {
      id: "requisitions",
      label: "Open Requisitions",
      value: m.openRequisitions,
      format: "number",
      note: "Awaiting purchase action",
      direction: m.openRequisitions > 0 ? "up" : "flat",
      href: "/purchases?tab=requisitions",
    },
    {
      id: "pos",
      label: "Open Purchase Orders",
      value: m.openPurchaseOrders,
      format: "number",
      note: `${m.openInspections} inspections open`,
      direction: "flat",
      href: "/purchases?tab=purchase-orders",
    },
    {
      id: "awaiting",
      label: "Awaiting Receipt",
      value: m.posAwaitingReceipt,
      format: "number",
      note: "POs not yet received",
      direction: m.posAwaitingReceipt > 0 ? "down" : "flat",
      href: "/purchases?tab=goods-receipts",
    },
  ]);

  const chart = toPart(summary, (s) => ({
    format: "currency" as const,
    focusIndex: s.monthlySpend.length - 1,
    bars: s.monthlySpend.map((m): ChartBar => {
      const name = MONTHS[Number(m.month.slice(5, 7)) - 1] ?? m.month;
      return {
        label: name,
        full: `${name} ${m.month.slice(0, 4)}: ${formatValue(m.total, "currency")} across ${m.orders} PO(s)`,
        value: m.total,
        muted: m.total === 0,
        href: "/purchases?tab=purchase-orders",
      };
    }),
  }));

  const gauge = toPart(overview, ({ metrics: m }) => {
    const moving = Math.max(0, m.openPurchaseOrders - m.posAwaitingReceipt);
    return {
      percent: pct(m.posAwaitingReceipt, m.openPurchaseOrders),
      caption: "Awaiting receipt",
      segments: [
        {
          label: "Awaiting receipt",
          value: m.posAwaitingReceipt,
          kind: "solid" as const,
        },
        { label: "Other open POs", value: moving, kind: "dark" as const },
      ],
    };
  });

  const list = toPart(summary, (s): ListItem[] =>
    s.awaitingApproval.map((a) => ({
      id: `approval-${a.type}-${a.id}`,
      title: `${a.number} · ${a.party}`,
      meta: `${a.type === "REQUISITION" ? "Requisition" : "Purchase order"} · waiting since ${shortDate(a.date)}`,
      href:
        a.type === "REQUISITION"
          ? "/purchases?tab=requisitions"
          : "/purchases?tab=purchase-orders",
      tone: a.type === "REQUISITION" ? "cyan" : "brand",
      badge: formatValue(a.total, "currency"),
    })),
  );

  return { kpis, chart, gauge, list };
}

// ── Sales ───────────────────────────────────────────────────────────────────

export function useSalesView(active: boolean): CoreView {
  const sales = useSalesDashboard(active);

  const kpis = toPart(sales, ({ kpis: k, pipeline: p }): Kpi[] => [
    {
      id: "revenue",
      label: "Monthly Revenue",
      value: num(k.monthlyRevenue),
      format: "currency",
      note: `${k.invoicesThisMonth} invoices this month`,
      direction: "up",
      href: "/sales/tax-invoices",
    },
    {
      id: "outstanding",
      label: "Outstanding Dues",
      value: num(k.outstandingDues),
      format: "currency",
      note: `${p.invoices.unpaid} unpaid invoices`,
      direction: p.invoices.unpaid > 0 ? "down" : "flat",
      href: "/sales/tax-invoices",
    },
    {
      id: "collected",
      label: "Payments Collected",
      value: num(k.paymentsCollected),
      format: "currency",
      note: `${k.paymentsCount} payments received`,
      direction: "up",
      href: "/sales/payments",
    },
    {
      id: "customers",
      label: "Active Customers",
      value: k.activeCustomers,
      format: "number",
      note: `Of ${k.totalCustomers} customers`,
      direction: "flat",
      href: "/sales/customers",
    },
  ]);

  const chart = toPart(sales, (d) => {
    const now = new Date();
    const lastMonth = d.year === now.getFullYear() ? now.getMonth() + 1 : 12;
    const months = d.monthlyRevenueVsCollections
      .filter((m) => m.month <= lastMonth)
      .slice(-7);
    return {
      format: "currency" as const,
      focusIndex: months.length - 1,
      bars: months.map((m): ChartBar => {
        const name = MONTHS[m.month - 1] ?? String(m.month);
        const revenue = num(m.revenue);
        return {
          label: name,
          full: `${name} ${d.year}: ${formatValue(revenue, "currency")} invoiced, ${formatValue(num(m.collections), "currency")} collected`,
          value: revenue,
          muted: revenue === 0,
          href: "/sales/tax-invoices",
        };
      }),
    };
  });

  const gauge = toPart(sales, ({ receivables: r }) => ({
    percent: r.collectedPercent,
    caption: "Collected",
    format: "currency" as const,
    segments: [
      { label: "Collected", value: num(r.collected), kind: "solid" as const },
      {
        label: "Outstanding",
        value: num(r.outstanding),
        kind: "striped" as const,
      },
    ],
  }));

  const list = toPart(sales, (d): ListItem[] =>
    d.recentActivity.slice(0, 5).map((a, i) => ({
      id: `sales-${i}-${a.documentNumber}`,
      title: `${titleCase(a.documentType)} ${a.documentNumber}`,
      meta: `${a.customerName} · ${shortDate(a.date)} · ${formatValue(num(a.amount), "currency")}`,
      href: "/sales/dashboard",
      tone: (["brand", "cyan", "sky"] as const)[i % 3] ?? "brand",
      badge: titleCase(a.status),
    })),
  );

  return { kpis, chart, gauge, list };
}

// ── Finance ─────────────────────────────────────────────────────────────────

/** Indian financial year start (1 April) for an IST `YYYY-MM-DD`. */
function financialYearStart(today: string): string {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  return `${month >= 4 ? year : year - 1}-04-01`;
}

/** Open supplier bills, earliest due first (overdue on top). */
async function listBillsToPay(limit: number): Promise<SupplierBill[]> {
  // The bills list is ordered newest bill first, so each open status is
  // fetched and the merge is re-sorted by due date here.
  const [open, partial] = await Promise.all([
    scmList<SupplierBill>("/scm/finance/bills", {
      page: 1,
      limit: 100,
      status: "OPEN",
    }),
    scmList<SupplierBill>("/scm/finance/bills", {
      page: 1,
      limit: 100,
      status: "PARTIALLY_PAID",
    }),
  ]);
  return [...open.data, ...partial.data]
    .filter((b) => b.outstanding > 0)
    .sort(
      (a, b) =>
        (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") ||
        a.id - b.id,
    )
    .slice(0, limit);
}

export function useFinanceView(
  active: boolean,
  today: string,
  access: { payables: boolean },
): CoreView {
  const organizationId = useAuthStore((s) => s.organizationId);
  const from = financialYearStart(today);
  const enabled = active && Boolean(organizationId);
  const pnl = useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "admin-dashboard",
      "finance-pnl",
      from,
      today,
    ),
    queryFn: () => getProfitAndLoss({ startDate: from, endDate: today }),
    enabled,
  });
  const balance = useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "admin-dashboard",
      "finance-bs",
      today,
    ),
    queryFn: () => getBalanceSheet({ asOfDate: today }),
    enabled,
  });

  const trend = useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "admin-dashboard",
      "finance-trend",
      7,
    ),
    queryFn: () => getMonthlyTrend(7),
    enabled,
  });
  const bills = useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "admin-dashboard",
      "bills-to-pay",
    ),
    queryFn: () => listBillsToPay(5),
    enabled: enabled && access.payables,
  });

  const kpis = combine<Kpi[]>(
    [qp(pnl), qp(balance)],
    pnl.data !== undefined,
    () => {
      const p = pnl.data;
      const net = p?.netIncome ?? 0;
      return [
        {
          id: "revenue",
          label: "Revenue",
          value: p?.revenue.total ?? null,
          format: "currency",
          note: `Since ${shortDate(from)}`,
          direction: "up",
          href: "/finance/reports",
        },
        {
          id: "expenses",
          label: "Expenses",
          value: p?.expenses.total ?? null,
          format: "currency",
          note: `${p?.expenses.accounts.length ?? 0} expense accounts`,
          direction: "down",
          href: "/finance/expenses",
        },
        {
          id: "net",
          label: net >= 0 ? "Net Profit" : "Net Loss",
          value: p ? net : null,
          format: "currency",
          note: p?.isProfitable
            ? "Profitable this year"
            : "Expenses exceed revenue",
          direction: net >= 0 ? "up" : "down",
          href: "/finance/reports",
        },
        {
          id: "assets",
          label: "Total Assets",
          value: balance.data?.assets.total ?? null,
          format: "currency",
          note: balance.data
            ? balance.data.isBalanced
              ? "Balance sheet balanced"
              : "Balance sheet out of balance"
            : "Balance sheet unavailable",
          direction: "flat",
          href: "/finance/reports",
        },
      ];
    },
  );

  const chart = toPart(trend, (months) => ({
    format: "currency" as const,
    focusIndex: months.length - 1,
    bars: months.map((m): ChartBar => {
      const name = MONTHS[Number(m.month.slice(5, 7)) - 1] ?? m.month;
      return {
        label: name,
        full: `${name} ${m.month.slice(0, 4)}: revenue ${formatValue(m.revenue, "currency")} · expenses ${formatValue(m.expenses, "currency")} · net ${formatValue(m.netIncome, "currency")}`,
        value: Math.max(0, m.revenue),
        muted: m.revenue <= 0,
        href: "/finance/reports",
      };
    }),
  }));

  const gauge = toPart(pnl, (p) => {
    const profit = Math.max(0, p.netIncome);
    return {
      percent: pct(profit, p.revenue.total),
      caption: p.revenue.total > 0 ? "Net margin" : "No revenue posted yet",
      format: "currency" as const,
      segments: [
        { label: "Net profit", value: profit, kind: "solid" as const },
        { label: "Expenses", value: p.expenses.total, kind: "dark" as const },
      ],
    };
  });

  const list = toPart(bills, (rows): ListItem[] =>
    rows.map((b) => ({
      id: `bill-${b.id}`,
      title: `${b.billNumber} · ${b.supplier.companyName}`,
      meta: b.dueDate
        ? `${b.overdue ? "Overdue since" : "Due"} ${shortDate(b.dueDate)}`
        : "No due date",
      href: "/finance/payments-made",
      tone: b.overdue ? "error" : "warning",
      badge: formatValue(b.outstanding, "currency"),
    })),
  );

  return { kpis, chart, gauge, list };
}

// ── CRM ─────────────────────────────────────────────────────────────────────

export function useCrmView(active: boolean): CoreView {
  const organizationId = useAuthStore((s) => s.organizationId);
  // Same key as `useCrmDashboard`, so the CRM dashboard page shares this cache entry.
  const crm = useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "crm-dashboard"),
    queryFn: getCrmDashboard,
    enabled: active && Boolean(organizationId),
    staleTime: 60 * 1000,
  });

  const kpis = toPart(
    crm,
    ({ pipeline: p, overview: o }: CrmDashboard): Kpi[] => [
      {
        id: "pipeline",
        label: "Open Pipeline",
        value: p?.openValue ?? null,
        format: "currency",
        note: p ? `${p.openCount} open deals` : "Opportunity access needed",
        direction: "up",
        href: "/crm/pipeline",
      },
      {
        id: "won",
        label: "Won Revenue",
        value: p?.totalRevenue ?? null,
        format: "currency",
        note: p ? `${p.wonCount} deals won` : "Opportunity access needed",
        direction: "up",
        href: "/crm/pipeline",
      },
      {
        id: "leads",
        label: "Total Leads",
        value: o.totalLeads,
        format: "number",
        note:
          o.convertedLeads !== null
            ? `${o.convertedLeads} converted`
            : "Lead access needed",
        direction: "flat",
        href: "/crm/overall-data",
      },
      {
        id: "follow-ups",
        label: "Pending Follow-ups",
        value: o.pendingFollowUpsCount,
        format: "number",
        note:
          o.scheduledMeetingsCount !== null
            ? `${o.scheduledMeetingsCount} meetings scheduled`
            : "Meeting access needed",
        direction: (o.pendingFollowUpsCount ?? 0) > 0 ? "down" : "flat",
        href: "/crm/dashboard",
      },
    ],
  );

  const chart = toPart(crm, ({ pipeline: p }) => ({
    format: "number" as const,
    bars: (p?.stageValue ?? []).slice(0, 7).map((s): ChartBar => ({
      label: abbreviate(s.label),
      full: `${s.label}: ${s.count} deals · ${formatValue(s.value, "currency")}`,
      value: s.count,
      muted: s.count === 0,
      href: "/crm/pipeline",
    })),
  }));

  const gauge = toPart(crm, ({ pipeline: p }) => ({
    percent: p ? pct(p.wonCount, p.wonCount + p.lostCount) : 0,
    caption: "Deals won",
    segments: p
      ? [
          { label: "Won", value: p.wonCount, kind: "solid" as const },
          { label: "Lost", value: p.lostCount, kind: "dark" as const },
          { label: "Open", value: p.openCount, kind: "striped" as const },
        ]
      : [],
  }));

  const list = toPart(crm, ({ work }): ListItem[] => {
    const buckets = [
      { items: work.overdue.items, tone: "error" as const, badge: "Overdue" },
      {
        items: work.needsAttention.items,
        tone: "warning" as const,
        badge: "Attention",
      },
      {
        items: work.todaysMeetings.items,
        tone: "brand" as const,
        badge: "Today",
      },
      {
        items: work.todaysFollowups.items,
        tone: "cyan" as const,
        badge: "Today",
      },
    ];
    const seen = new Set<string>();
    const out: ListItem[] = [];
    for (const b of buckets) {
      for (const item of b.items) {
        if (seen.has(item.id) || out.length >= 5) continue;
        seen.add(item.id);
        out.push({
          id: `crm-${item.id}`,
          title: item.title,
          meta: [item.kind, item.accountName, shortDate(item.dueAt)]
            .filter(Boolean)
            .join(" · "),
          href: item.href,
          tone: b.tone,
          badge: b.badge,
        });
      }
    }
    return out;
  });

  return { kpis, chart, gauge, list };
}

// ── Projects ────────────────────────────────────────────────────────────────

export function useProjectsView(active: boolean): CoreView {
  const organizationId = useAuthStore((s) => s.organizationId);
  const metrics = useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "admin-dashboard", "projects"),
    queryFn: getDashboardMetrics,
    enabled: active && Boolean(organizationId),
  });

  const hours = useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "admin-dashboard",
      "project-hours",
      7,
    ),
    queryFn: () => getHoursTrend(7),
    enabled: active && Boolean(organizationId),
  });

  const kpis = toPart(metrics, (m): Kpi[] => [
    {
      id: "total",
      label: "Total Projects",
      value: m.totalProjects,
      format: "number",
      note: `${m.upcomingMilestonesCount} milestones coming up`,
      direction: "up",
      href: "/projects/list",
    },
    {
      id: "active",
      label: "Running Projects",
      value: m.activeProjects,
      format: "number",
      note: `${m.onTrackProjects} on track`,
      direction: "up",
      href: "/projects/list",
    },
    {
      id: "completed",
      label: "Ended Projects",
      value: m.completedProjects,
      format: "number",
      note: `${pct(m.completedProjects, m.totalProjects)}% of all projects`,
      direction: "flat",
      href: "/projects/list",
    },
    {
      id: "delayed",
      label: "Delayed Projects",
      value: m.delayedProjects,
      format: "number",
      note: `${m.openTasksCount} open tasks`,
      direction: m.delayedProjects > 0 ? "down" : "flat",
      href: "/projects/analytics",
    },
  ]);

  const chart = toPart(hours, (weeks) => ({
    format: "number" as const,
    focusIndex: weeks.length - 1,
    bars: weeks.map((w): ChartBar => ({
      label: shortDate(w.weekStart).replace(" ", "\u00a0"),
      full: `Week of ${shortDate(w.weekStart)}: ${w.hours.toLocaleString("en-IN")} h across ${w.entries} time entries`,
      value: Math.round(w.hours),
      muted: w.entries === 0,
      href: "/projects/resources",
    })),
  }));

  const gauge = toPart(metrics, ({ milestoneHealth: h }) => ({
    percent: pct(h.completed, h.total),
    caption: "Milestones completed",
    segments: [
      { label: "Completed", value: h.completed, kind: "solid" as const },
      { label: "On track", value: h.onTrack, kind: "dark" as const },
      { label: "Delayed", value: h.delayed, kind: "striped" as const },
    ],
  }));

  const list = toPart(metrics, (m): ListItem[] => [
    {
      id: "over-budget",
      title: "Over budget",
      meta: "Actual cost above contract price",
      href: "/projects/budget-utilization",
      tone: m.overBudgetProjects > 0 ? "error" : "success",
      badge: String(m.overBudgetProjects),
    },
    {
      id: "over-hours",
      title: "Over hours",
      meta: `${Math.round(m.hours.totalLoggedHours)} of ${Math.round(m.hours.totalExpectedHours)} hours logged`,
      href: "/projects/resources",
      tone: m.overHoursProjects > 0 ? "warning" : "success",
      badge: String(m.overHoursProjects),
    },
    {
      id: "milestones",
      title: "Upcoming milestones",
      meta: `${m.milestoneHealth.delayed} delayed so far`,
      href: "/projects/analytics",
      tone: "brand",
      badge: String(m.upcomingMilestonesCount),
    },
    {
      id: "budget",
      title: "Budget utilization",
      meta: `${formatValue(m.financials.totalActualSpend, "currency")} of ${formatValue(m.financials.totalContractPrice, "currency")}`,
      href: "/projects/budget-utilization",
      tone: "cyan",
      badge: `${Math.round(m.financials.overallBudgetUtilizationPercent)}%`,
    },
  ]);

  return { kpis, chart, gauge, list };
}
