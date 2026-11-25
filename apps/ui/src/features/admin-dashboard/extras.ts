"use client";

// Reminder, people list and spotlight for each module: the module-specific
// half of the dashboard (the analytics half lives in hooks.ts). Every query
// reuses an existing endpoint and, where the module page already fetches it,
// the same query key, so opening the module afterwards is instant.

import { useQuery } from "@tanstack/react-query";
import { orgScopedKey } from "@texawave-erp/core";
import type {
  CrmDashboard,
  FinanceBankAccount,
  FinancePaymentReceived,
  ProcurementDashboardSummary,
  PurchaseOrder,
  ReplenishmentRow,
  ScmOverview,
  Shipment,
} from "@texawave-erp/api-types";
import {
  CalendarCheck,
  ClipboardList,
  Clock,
  FileText,
  FolderKanban,
  Landmark,
  Receipt,
  ShoppingCart,
  Target,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { getCrmDashboard } from "@/features/crm/dashboard/api";
import {
  listBankAccounts,
  listBankTransactions,
} from "@/features/finance/banking/api";
import { listPaymentsReceived } from "@/features/finance/payments-received/api";
import {
  getDashboardMetrics,
  getResourceTracking,
} from "@/features/projects/api";
import { useSalesDashboard } from "@/features/sales/dashboard/hooks";
import type { AttentionKind } from "@/features/sales/dashboard/types";
import { scmGet } from "@/features/scm/shared/scm-api";
import { useScmData, useScmList } from "@/features/scm/shared/scm-hooks";
import {
  useDailyAttendance,
  useLatestLeaveRequests,
  useUpcomingHolidays,
} from "@/features/hr/dashboard/hooks";
import type { LeaveRequestRow } from "@/features/hr/dashboard/types";
import { formatValue, num, pct, toPart } from "./format";
import { shortDate, titleCase } from "./hooks";
import type { ExtrasView, ItemTone, PersonRow, Reminder } from "./types";

const DAY_MS = 86_400_000;

function daysFrom(today: string, date: string): number {
  return Math.round(
    (Date.parse(`${date.slice(0, 10)}T00:00:00Z`) -
      Date.parse(`${today}T00:00:00Z`)) /
      DAY_MS,
  );
}

/** "today", "tomorrow", "in 5 days", "3 days overdue". */
function relative(today: string, date: string, pastWord = "overdue"): string {
  const d = daysFrom(today, date);
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d > 1) return `in ${d} days`;
  return `${-d} day${d === -1 ? "" : "s"} ${pastWord}`;
}

const STATUS_TONE: Record<string, ItemTone> = {
  APPROVED: "success",
  COMPLETED: "success",
  DELIVERED: "success",
  RECEIVED: "success",
  PENDING: "warning",
  PENDING_APPROVAL: "warning",
  PARTIALLY_RECEIVED: "warning",
  IN_TRANSIT: "sky",
  SHIPPED: "sky",
  SENT: "sky",
  DRAFT: "slate",
  CANCELLED: "slate",
  REJECTED: "error",
  FAILED: "error",
};

function statusTone(status: string): ItemTone {
  return STATUS_TONE[status.toUpperCase()] ?? "brand";
}

// ── HR ──────────────────────────────────────────────────────────────────────

export interface HrExtrasAccess {
  leaves: boolean;
  holidays: boolean;
  attendance: boolean;
}

const LEAVE_TONE: Record<LeaveRequestRow["status"], ItemTone> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "error",
  CANCELLED: "slate",
};

function leaveRange(start: string, end: string): string {
  return start === end
    ? shortDate(start)
    : `${shortDate(start)} – ${shortDate(end)}`;
}

export function useHrExtras(
  active: boolean,
  access: HrExtrasAccess,
  today: string,
): ExtrasView {
  const holidays = useUpcomingHolidays(today, active && access.holidays);
  const leaves = useLatestLeaveRequests(active && access.leaves);
  const attendance = useDailyAttendance(today, active && access.attendance);

  const reminder = toPart(holidays, (rows): Reminder => {
    const upcoming = rows.filter((h) => h.holidayDate >= today);
    const next = upcoming[0];
    if (!next) {
      return {
        headline: "No holidays coming up",
        lines: ["Nothing on the holiday calendar for the next 60 days."],
        cta: { label: "View holiday calendar", href: "/hr/holidays" },
      };
    }
    return {
      headline: next.name,
      lines: [
        `Date : ${shortDate(next.holidayDate)} · ${relative(today, next.holidayDate)}`,
        ...(upcoming.length > 1
          ? [`${upcoming.length - 1} more holiday(s) in the next 60 days`]
          : []),
      ],
      cta: { label: "View holiday calendar", href: "/hr/holidays" },
    };
  });

  const people = toPart(leaves, (rows): PersonRow[] =>
    rows.map((r) => ({
      id: `leave-${r.id}`,
      name: r.employee.fullName,
      sub: `Requested ${r.leaveType.name} for ${leaveRange(r.startDate, r.endDate)}`,
      href: "/hr/leaves",
      badge: titleCase(r.status),
      tone: LEAVE_TONE[r.status],
    })),
  );

  // The clock itself needs no data; attendance only adds the "present" line.
  const counts = attendance.data?.counts;
  const spotlight = {
    data: active
      ? {
          value: null,
          caption: "India Standard Time",
          lines: counts
            ? [
                `${counts.present} of ${attendance.data?.rows.length ?? 0} employees present`,
              ]
            : [],
          actions: [
            { label: "Open attendance", href: "/hr/attendance", icon: Clock },
            {
              label: "Open regularization requests",
              href: "/hr/regularization",
              icon: CalendarCheck,
            },
          ],
        }
      : null,
    loading: false,
    error: false,
    retry: () => void attendance.refetch(),
  };

  return { reminder, people, spotlight };
}

// ── SCM ─────────────────────────────────────────────────────────────────────

export function useScmExtras(
  active: boolean,
  access: { logistics: boolean },
): ExtrasView {
  // Same resource/keys as `useScmOverview` and `useReplenishment`.
  const overview = useScmData<ScmOverview>(
    "overview",
    ["overview"],
    () => scmGet("/scm/overview"),
    active,
  );
  const replenishment = useScmData<ReplenishmentRow[]>(
    "overview",
    ["replenishment"],
    () => scmGet("/scm/advanced/replenishment"),
    active,
  );
  const shipments = useScmList<Shipment>(
    "shipments",
    "/scm/shipments",
    { page: 1, limit: 4 },
    active && access.logistics,
  );

  const reminder = toPart(replenishment, (rows): Reminder => {
    const urgent = [...rows].sort(
      (a, b) =>
        a.available / (a.reorderLevel || 1) -
        b.available / (b.reorderLevel || 1),
    );
    const top = urgent[0];
    if (!top) {
      return {
        headline: "Stock is above reorder level",
        lines: ["No product needs replenishment right now."],
        cta: { label: "Open inventory", href: "/scm/inventory/overview" },
      };
    }
    return {
      headline: `Reorder ${top.productName}`,
      lines: [
        `${top.available} left at ${top.warehouse} · reorder level ${top.reorderLevel}`,
        `Recommended ${top.recommendedQty} units · ${formatValue(top.estimatedCost, "currency")}`,
        ...(rows.length > 1
          ? [`${rows.length - 1} more item(s) to reorder`]
          : []),
      ],
      cta: { label: "Plan replenishment", href: "/scm/advanced/replenishment" },
      urgent: top.available <= 0,
    };
  });

  const people = toPart(shipments, (res): PersonRow[] =>
    res.data.map((s) => ({
      id: `shipment-${s.id}`,
      name: s.customerName,
      sub: [
        s.shipmentNumber,
        s.carrierName ?? "No carrier",
        s.expectedDeliveryDate
          ? `ETA ${shortDate(s.expectedDeliveryDate)}`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
      href: "/scm/logistics",
      badge: titleCase(s.status),
      tone: statusTone(s.status),
    })),
  );

  const spotlight = toPart(overview, ({ metrics: m }) => ({
    value: m.openSalesOrders.toLocaleString("en-IN"),
    caption: "Open sales orders to fulfil",
    lines: [
      `${m.openShipments} shipment(s) on the way`,
      `${m.posAwaitingReceipt} purchase order(s) awaiting receipt`,
    ],
    actions: [
      {
        label: "Open sales orders",
        href: "/scm/orders/sales-orders",
        icon: ClipboardList,
      },
      { label: "Open logistics", href: "/scm/logistics", icon: Truck },
    ],
  }));

  return { reminder, people, spotlight };
}

// ── Purchases ───────────────────────────────────────────────────────────────

export function usePurchasesExtras(
  active: boolean,
  access: { procurement: boolean },
  today: string,
): ExtrasView {
  const enabled = active && access.procurement;
  // Same resource/key as `useProcurementDashboard`.
  const summary = useScmData<ProcurementDashboardSummary>(
    "procurement",
    ["dashboard"],
    () => scmGet("/scm/procurement/dashboard"),
    enabled,
  );
  const orders = useScmList<PurchaseOrder>(
    "purchase-orders",
    "/scm/procurement/purchase-orders",
    { page: 1, limit: 4 },
    enabled,
  );

  const reminder = toPart(summary, (s): Reminder => {
    const next = s.upcomingDeliveries[0];
    if (!next?.expectedDeliveryDate) {
      return {
        headline: "No deliveries scheduled",
        lines: ["No open purchase order has an expected delivery date."],
        cta: {
          label: "View purchase orders",
          href: "/purchases?tab=purchase-orders",
        },
      };
    }
    const late = next.expectedDeliveryDate < today;
    return {
      headline: `${next.poNumber} from ${next.vendorName}`,
      lines: [
        `Delivery : ${shortDate(next.expectedDeliveryDate)} · ${relative(today, next.expectedDeliveryDate)}`,
        `Order value ${formatValue(next.total, "currency")}`,
        ...(s.overdueDeliveries > 0
          ? [`${s.overdueDeliveries} open PO(s) past their delivery date`]
          : []),
      ],
      cta: {
        label: "Record goods receipt",
        href: "/purchases?tab=goods-receipts",
      },
      urgent: late,
    };
  });

  const people = toPart(orders, (res): PersonRow[] =>
    res.data.map((po) => ({
      id: `po-${po.id}`,
      name: po.vendorNameSnapshot,
      sub: `${po.poNumber} · ${shortDate(po.poDate)} · ${formatValue(num(po.total), "currency")}`,
      href: "/purchases?tab=purchase-orders",
      badge: titleCase(po.status),
      tone: statusTone(po.status),
    })),
  );

  const spotlight = toPart(summary, (s) => {
    const open = ["APPROVED", "SENT", "PARTIALLY_RECEIVED"].reduce(
      (sum, k) => sum + (s.purchaseOrders[k] ?? 0),
      0,
    );
    return {
      value: formatValue(s.openPurchaseOrderValue, "currency"),
      caption: `Committed across ${open} open purchase order(s)`,
      lines: [`${s.goodsReceipts} goods receipts completed`],
      actions: [
        {
          label: "Open purchase orders",
          href: "/purchases?tab=purchase-orders",
          icon: ShoppingCart,
        },
        {
          label: "Open payments made",
          href: "/purchases?tab=payments-made",
          icon: Wallet,
        },
      ],
    };
  });

  return { reminder, people, spotlight };
}

// ── Sales ───────────────────────────────────────────────────────────────────

const ATTENTION: Record<AttentionKind, { label: string; href: string }> = {
  overdue_invoices: { label: "overdue invoices", href: "/sales/tax-invoices" },
  unpaid_invoices: { label: "unpaid invoices", href: "/sales/tax-invoices" },
  pending_quotations: {
    label: "quotations awaiting sign-off",
    href: "/sales/quotations",
  },
  open_returnable_dcs: {
    label: "open returnable DCs",
    href: "/sales/returnable-dcs",
  },
  overdue_follow_ups: { label: "overdue follow-ups", href: "/sales/dashboard" },
};

const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, info: 3 } as const;

export function useSalesExtras(active: boolean): ExtrasView {
  const sales = useSalesDashboard(active); // shared with the Sales dashboard page

  const reminder = toPart(sales, (d): Reminder => {
    const top = [...d.needsAttention]
      .filter((n) => n.count > 0)
      .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority])[0];
    if (!top) {
      return {
        headline: "Nothing needs attention",
        lines: ["No overdue invoices, pending quotations or follow-ups."],
        cta: { label: "Open sales dashboard", href: "/sales/dashboard" },
      };
    }
    const meta = ATTENTION[top.kind];
    return {
      headline: `${top.count} ${meta.label}`,
      lines: [
        ...(top.amount !== null
          ? [`Worth ${formatValue(num(top.amount), "currency")}`]
          : []),
        `Action items : ${d.checklist.open} open · ${d.checklist.overdue} overdue`,
      ],
      cta: { label: "Review now", href: meta.href },
      urgent: top.priority === "critical" || top.priority === "high",
    };
  });

  const people = toPart(sales, (d): PersonRow[] =>
    d.topClients.slice(0, 4).map((c, i) => ({
      id: `client-${c.customerId}`,
      name: c.companyName,
      sub: `Rank #${c.rank} · ${c.sharePercent}% of revenue`,
      href: "/sales/customers",
      badge: formatValue(num(c.revenue), "currency"),
      tone: (["brand", "cyan", "sky", "success"] as const)[i] ?? "brand",
    })),
  );

  const spotlight = toPart(sales, (d) => {
    const now = new Date();
    const month =
      d.year === now.getFullYear()
        ? d.monthlyRevenueVsCollections.find(
            (m) => m.month === now.getMonth() + 1,
          )
        : undefined;
    const name = now.toLocaleDateString("en-IN", { month: "long" });
    return {
      value: formatValue(num(month?.collections), "currency"),
      caption: `Collected in ${name}`,
      lines: [
        `Invoiced ${formatValue(num(month?.revenue), "currency")} this month`,
        `${d.receivables.collectedPercent}% of all billing collected`,
      ],
      actions: [
        { label: "Open payments", href: "/sales/payments", icon: Receipt },
        { label: "Open invoices", href: "/sales/tax-invoices", icon: FileText },
      ],
    };
  });

  return { reminder, people, spotlight };
}

// ── Finance ─────────────────────────────────────────────────────────────────

export function useFinanceExtras(
  active: boolean,
  access: { banking: boolean; paymentsReceived: boolean },
): ExtrasView {
  const organizationId = useAuthStore((s) => s.organizationId);
  const key = (...parts: (string | number)[]) =>
    orgScopedKey(organizationId ?? 0, "admin-dashboard", "finance", ...parts);
  const ready = active && Boolean(organizationId);

  const accounts = useQuery({
    queryKey: key("bank-accounts"),
    queryFn: async (): Promise<FinanceBankAccount[]> =>
      (await listBankAccounts({ page: 1, limit: 100 })).data,
    enabled: ready && access.banking,
  });
  const unreconciled = useQuery({
    queryKey: key("unreconciled"),
    queryFn: async () =>
      (await listBankTransactions({ page: 1, limit: 1, isReconciled: false }))
        .meta.total,
    enabled: ready && access.banking,
  });
  const received = useQuery({
    queryKey: key("payments-received"),
    queryFn: async (): Promise<FinancePaymentReceived[]> =>
      (await listPaymentsReceived({ page: 1, limit: 4 })).data,
    enabled: ready && access.paymentsReceived,
  });

  const reminder = toPart(unreconciled, (count): Reminder =>
    count > 0
      ? {
          headline: `${count} bank transaction${count === 1 ? "" : "s"} to reconcile`,
          lines: [
            "Unreconciled entries keep the ledger and bank statement apart.",
          ],
          cta: { label: "Reconcile now", href: "/finance/banking" },
          urgent: true,
        }
      : {
          headline: "Bank fully reconciled",
          lines: ["Every bank transaction is matched to the ledger."],
          cta: { label: "Open banking", href: "/finance/banking" },
        },
  );

  const people = toPart(received, (rows): PersonRow[] =>
    rows.map((p) => ({
      id: `received-${p.id}`,
      name: p.customerName,
      sub: `${p.paymentNumber} · ${shortDate(p.paymentDate)}`,
      href: "/finance/payments-received",
      badge: formatValue(num(p.amount), "currency"),
      tone: statusTone(String(p.status)),
    })),
  );

  const spotlight = toPart(accounts, (rows) => {
    const live = rows.filter((a) => a.isActive);
    const total = live.reduce((sum, a) => sum + num(a.currentBalance), 0);
    return {
      value: formatValue(total, "currency"),
      caption: `Across ${live.length} active bank account(s)`,
      lines: [...live]
        .sort((a, b) => num(b.currentBalance) - num(a.currentBalance))
        .slice(0, 2)
        .map(
          (a) =>
            `${a.bankName}: ${formatValue(num(a.currentBalance), "currency")}`,
        ),
      actions: [
        { label: "Open banking", href: "/finance/banking", icon: Landmark },
        {
          label: "Open payments received",
          href: "/finance/payments-received",
          icon: Wallet,
        },
      ],
    };
  });

  return { reminder, people, spotlight };
}

// ── CRM ─────────────────────────────────────────────────────────────────────

export function useCrmExtras(active: boolean): ExtrasView {
  const organizationId = useAuthStore((s) => s.organizationId);
  // Same key as `useCrmDashboard` (and useCrmView): one request per visit.
  const crm = useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "crm-dashboard"),
    queryFn: getCrmDashboard,
    enabled: active && Boolean(organizationId),
    staleTime: 60 * 1000,
  });

  const reminder = toPart(crm, ({ work }: CrmDashboard): Reminder => {
    const next =
      work.todaysMeetings.items[0] ??
      work.tomorrowMeetings.items[0] ??
      work.todaysFollowups.items[0] ??
      work.upcomingFollowups.items[0];
    if (!next) {
      return {
        headline: "No meetings or follow-ups due",
        lines: [
          `${work.overdue.count} overdue · ${work.missedFollowups.count} missed follow-ups`,
        ],
        cta: { label: "Open CRM dashboard", href: "/crm/dashboard" },
        urgent: work.overdue.count > 0,
      };
    }
    const at = new Date(next.dueAt);
    return {
      headline: next.title,
      lines: [
        `${next.kind}${next.accountName ? ` with ${next.accountName}` : ""}`,
        `Time : ${at.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}`,
      ],
      cta: {
        label: next.kind === "Meeting" ? "Open meeting" : "Open follow-up",
        href: next.href,
      },
    };
  });

  const people = toPart(crm, ({ team }: CrmDashboard): PersonRow[] =>
    [...(team ?? [])]
      .sort((a, b) => b.wonValue - a.wonValue)
      .slice(0, 4)
      .map((r, i) => ({
        id: `rep-${r.repName}-${i}`,
        name: r.repName,
        sub: `${r.won} won · ${r.open} open · ${formatValue(r.wonValue, "currency")}`,
        href: "/crm/dashboard",
        badge: `${Math.round(r.winRate)}% win`,
        tone:
          r.winRate >= 50 ? "success" : r.winRate >= 25 ? "brand" : "warning",
      })),
  );

  const spotlight = toPart(crm, ({ pipeline: p }: CrmDashboard) => ({
    value: p ? formatValue(p.weightedValue, "currency") : "—",
    caption: "Probability-weighted open pipeline",
    lines: p
      ? [
          `Commit ${formatValue(p.forecastBuckets.commit, "currency")} · Best case ${formatValue(p.forecastBuckets.bestCase, "currency")}`,
          `${p.dealsAtRisk} deal(s) at risk · avg cycle ${Math.round(p.avgSalesCycleDays)} days`,
        ]
      : ["Opportunity access needed"],
    actions: [
      { label: "Open pipeline", href: "/crm/pipeline", icon: Target },
      { label: "Open accounts", href: "/crm/accounts", icon: Users },
    ],
  }));

  return { reminder, people, spotlight };
}

// ── Projects ────────────────────────────────────────────────────────────────

const LOAD_TONE: Record<string, ItemTone> = {
  OVER_CAPACITY: "error",
  UNDER_UTILIZED: "warning",
  NORMAL: "success",
};

export function useProjectsExtras(active: boolean, today: string): ExtrasView {
  const organizationId = useAuthStore((s) => s.organizationId);
  const enabled = active && Boolean(organizationId);
  // Same key as useProjectsView, so the metrics are fetched once.
  const metrics = useQuery({
    queryKey: orgScopedKey(organizationId ?? 0, "admin-dashboard", "projects"),
    queryFn: getDashboardMetrics,
    enabled,
  });
  const resources = useQuery({
    queryKey: orgScopedKey(
      organizationId ?? 0,
      "admin-dashboard",
      "project-resources",
    ),
    queryFn: getResourceTracking,
    enabled,
  });

  const reminder = toPart(metrics, (m): Reminder => {
    const next = m.upcomingMilestones[0];
    if (!next) {
      return {
        headline: "No milestones due this week",
        lines: [
          `${m.milestoneHealth.delayed} milestone(s) already past their target`,
        ],
        cta: { label: "Open project analytics", href: "/projects/analytics" },
        urgent: m.milestoneHealth.delayed > 0,
      };
    }
    return {
      headline: next.title,
      lines: [
        `${next.projectCode} · ${next.projectName}`,
        `Due : ${shortDate(next.targetDate)} · ${relative(today, next.targetDate)}`,
        ...(m.upcomingMilestonesCount > 1
          ? [`${m.upcomingMilestonesCount - 1} more due within 7 days`]
          : []),
      ],
      cta: { label: "Open project", href: `/projects/${next.projectId}` },
    };
  });

  const people = toPart(resources, (r): PersonRow[] =>
    [...r.resources]
      .sort((a, b) => b.loggedHours - a.loggedHours)
      .slice(0, 4)
      .map((e) => ({
        id: `resource-${e.employeeId}`,
        name: e.employeeName,
        sub: `${e.activeTasksCount} active task(s) · ${Math.round(e.loggedHours)}h logged`,
        href: "/projects/resources",
        badge: `${Math.round(e.utilizationPercent)}%`,
        tone: LOAD_TONE[e.status] ?? "brand",
      })),
  );

  const spotlight = toPart(metrics, ({ hours: h, financials: f }) => ({
    value: `${Math.round(h.totalLoggedHours).toLocaleString("en-IN")}h`,
    caption: `${pct(h.totalLoggedHours, h.totalExpectedHours)}% of ${Math.round(h.totalExpectedHours).toLocaleString("en-IN")}h planned`,
    lines: [
      `Earned ${formatValue(f.totalEarnedRevenue, "currency")} · spent ${formatValue(f.totalActualSpend, "currency")}`,
    ],
    actions: [
      { label: "Open projects", href: "/projects/list", icon: FolderKanban },
      { label: "Open resources", href: "/projects/resources", icon: Users },
    ],
  }));

  return { reminder, people, spotlight };
}
