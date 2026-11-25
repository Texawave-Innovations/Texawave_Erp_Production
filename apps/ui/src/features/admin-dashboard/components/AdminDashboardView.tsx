"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  FolderKanban,
  FolderPlus,
  Landmark,
  LayoutGrid,
  ListChecks,
  Receipt,
  ShoppingCart,
  Target,
  UserPlus,
  Users,
} from "lucide-react";
import { Button, EmptyState, Tabs } from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/stores/auth-store";
import { FINANCE_REPORTS_READ } from "@/features/finance/reports/permissions";
import { SALES_PERMISSIONS } from "@/features/sales/permissions";
import {
  READ_ANY_SCOPE as EMPLOYEE_READ,
  ACCOUNT_WRITE,
  WRITE_TEAM_OR_ALL as EMPLOYEE_WRITE,
} from "@/features/hr/employees/permissions";
import { READ_ANY_SCOPE as ATTENDANCE_REPORT_READ } from "@/features/hr/full-month-present/permissions";
import { READ as HOLIDAY_READ } from "@/features/hr/holidays/permissions";
import { READ_ANY_SCOPE as LEAVE_REQUEST_READ } from "@/features/hr/leaves/permissions";
import { READ_ANY_SCOPE as CORRECTION_READ } from "@/features/hr/regularization/permissions";
import { READ_ANY_SCOPE as TASK_READ } from "@/features/hr/tasks/permissions";
import { FINANCE_BANKING_READ } from "@/features/finance/banking/permissions";
import { FINANCE_PAYMENT_RECEIVED_READ } from "@/features/finance/payments-received/permissions";
import { istToday } from "@/features/hr/dashboard/metrics";
import { CATEGORIES, categoryMeta } from "../categories";
import {
  useCrmView,
  useFinanceView,
  useHrView,
  useProjectsView,
  usePurchasesView,
  useSalesView,
  useScmView,
} from "../hooks";
import {
  useCrmExtras,
  useFinanceExtras,
  useHrExtras,
  useProjectsExtras,
  usePurchasesExtras,
  useSalesExtras,
  useScmExtras,
} from "../extras";
import type { CategoryId, CategoryView } from "../types";
import { DashboardCard, KpiCard, PartView, PillLink } from "./DashboardCard";
import { PillBarChart } from "./PillBarChart";
import { ProgressGauge } from "./ProgressGauge";
import { ItemList, PeopleList, ReminderView, SpotlightCard } from "./SideCards";

const ICONS: Record<CategoryId, LucideIcon> = {
  hr: Users,
  scm: Boxes,
  purchases: ShoppingCart,
  sales: Receipt,
  finance: Landmark,
  crm: Target,
  projects: FolderKanban,
};

interface PrimaryAction {
  label: string;
  href: string;
  icon: LucideIcon;
}

const STAGGER = ["stagger-1", "stagger-2", "stagger-3", "stagger-4"] as const;

const LIST_ICONS: Record<CategoryId, LucideIcon> = { ...ICONS, hr: ListChecks };

function greeting(date: Date): string {
  const hour = Number(
    date.toLocaleString("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Admin dashboard: every ERP module in one place. A module switcher swaps the
 * whole board — KPIs, analytics chart, reminder, work list, people list,
 * progress gauge and spotlight — and each card animates in on switch. Every
 * module reads its own endpoints, and only while its tab is open.
 */
export function AdminDashboardView() {
  const router = useRouter();
  const fullName = useAuthStore((s) => s.user?.fullName);
  const [now] = useState(() => new Date());
  const today = useMemo(() => istToday(now), [now]);

  // UI gating only; every endpoint enforces its own permission.
  const canEmployees = usePermission(EMPLOYEE_READ);
  const canAttendance = usePermission(ATTENDANCE_REPORT_READ);
  const canLeaves = usePermission(LEAVE_REQUEST_READ);
  const canCorrections = usePermission(CORRECTION_READ);
  const canTasks = usePermission(TASK_READ);
  const canHolidays = usePermission(HOLIDAY_READ);
  // Adding a new hire also creates their login, so it needs the account permission too.
  const canWriteEmployees = usePermission(EMPLOYEE_WRITE);
  const canWriteAccounts = usePermission(ACCOUNT_WRITE);
  const canCreateEmployee = canWriteEmployees && canWriteAccounts;
  const canScm = usePermission("scm.overview.read");
  const canSales = usePermission(SALES_PERMISSIONS.dashboardRead);
  const canFinance = usePermission(FINANCE_REPORTS_READ);
  const canCrm = usePermission("crm.dashboard.read");
  const canProjects = usePermission("projects.project.read");
  const canProcurement = usePermission("scm.procurement.read");
  const canPayables = usePermission("scm.finance.read");
  const canCreateProject = usePermission("projects.project.write");
  const canLogistics = usePermission("scm.logistics.read");
  const canBanking = usePermission(FINANCE_BANKING_READ);
  const canPaymentsReceived = usePermission(FINANCE_PAYMENT_RECEIVED_READ);

  const allowed: Record<CategoryId, boolean> = {
    hr: canEmployees || canAttendance,
    scm: canScm,
    purchases: canScm,
    sales: canSales,
    finance: canFinance,
    crm: canCrm,
    projects: canProjects,
  };
  const tabs = CATEGORIES.filter((c) => allowed[c.id]);
  const [picked, setPicked] = useState<CategoryId | null>(null);
  const category: CategoryId | null =
    picked && allowed[picked] ? picked : (tabs[0]?.id ?? null);
  const meta = categoryMeta(category ?? "hr");

  // Every adapter is called on every render (hook rules); only the open one fetches.
  const core = {
    hr: useHrView(
      category === "hr",
      {
        employees: canEmployees,
        attendance: canAttendance,
        approvals: canLeaves && canCorrections,
        tasks: canTasks,
      },
      today,
    ),
    scm: useScmView(category === "scm"),
    purchases: usePurchasesView(category === "purchases", {
      procurement: canProcurement,
    }),
    sales: useSalesView(category === "sales"),
    finance: useFinanceView(category === "finance", today, {
      payables: canPayables,
    }),
    crm: useCrmView(category === "crm"),
    projects: useProjectsView(category === "projects"),
  };
  const extras = {
    hr: useHrExtras(
      category === "hr",
      { leaves: canLeaves, holidays: canHolidays, attendance: canAttendance },
      today,
    ),
    scm: useScmExtras(category === "scm", { logistics: canLogistics }),
    purchases: usePurchasesExtras(
      category === "purchases",
      { procurement: canProcurement },
      today,
    ),
    sales: useSalesExtras(category === "sales"),
    finance: useFinanceExtras(category === "finance", {
      banking: canBanking,
      paymentsReceived: canPaymentsReceived,
    }),
    crm: useCrmExtras(category === "crm"),
    projects: useProjectsExtras(category === "projects", today),
  };

  const title = `${greeting(now)}${fullName ? `, ${fullName}` : ""}`;

  if (!category) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6 pb-12 animate-reveal">
        <DashboardHeader subtitle={title} actions={null} />
        <EmptyState
          title="No dashboard modules available"
          description="Your role does not include read access to any module summary. Ask an administrator for access."
        />
      </div>
    );
  }

  const view: CategoryView = { ...core[category], ...extras[category] };
  const primary: Record<CategoryId, PrimaryAction | null> = {
    hr: canCreateEmployee
      ? { label: "Add employee", href: "/hr/employees/new", icon: UserPlus }
      : null,
    scm: { label: "Inventory", href: "/scm/inventory/overview", icon: Boxes },
    purchases: {
      label: "Purchase orders",
      href: "/purchases?tab=purchase-orders",
      icon: ShoppingCart,
    },
    sales: {
      label: "Tax invoices",
      href: "/sales/tax-invoices",
      icon: Receipt,
    },
    finance: {
      label: "Journal entries",
      href: "/finance/journal-entries",
      icon: Landmark,
    },
    crm: { label: "Sales pipeline", href: "/crm/pipeline", icon: Target },
    projects: canCreateProject
      ? { label: "New project", href: "/projects/new", icon: FolderPlus }
      : null,
  };
  const action = primary[category];
  const ListIcon = LIST_ICONS[category];

  // Module-scoped board; rendered inside the ui-kit Tabs panel when the user
  // can read more than one module.
  const content = (
    <div className="space-y-5">
      {/* KPI row: re-keyed per module so cards and counters replay their entrance. */}
      <section
        key={`kpis-${category}`}
        aria-label={`${meta.label} key figures`}
      >
        <PartView
          part={view.kpis}
          label={`${meta.label} key figures`}
          skeletonHeight="h-[150px]"
        >
          {(kpis) => (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {kpis.map((kpi, i) => (
                <KpiCard
                  key={kpi.id}
                  kpi={kpi}
                  highlighted={i === 0}
                  className={`animate-reveal ${STAGGER[i] ?? ""}`}
                />
              ))}
            </div>
          )}
        </PartView>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
        <DashboardCard
          key={`chart-${category}`}
          title={meta.chartTitle}
          headingId="admin-chart-heading"
          action={
            <span className="hidden text-xs text-gray-500 sm:inline dark:text-gray-400">
              {meta.chartCaption}
            </span>
          }
          className="animate-reveal stagger-2 md:col-span-2 xl:col-span-6"
        >
          <PartView
            part={view.chart}
            label={meta.chartTitle.toLowerCase()}
            skeletonHeight="h-48"
          >
            {(chart) => (
              <PillBarChart
                data={chart}
                label={`${meta.chartTitle}: ${meta.chartCaption}`}
              />
            )}
          </PartView>
        </DashboardCard>

        <DashboardCard
          key={`reminder-${category}`}
          title="Reminders"
          headingId="admin-reminders-heading"
          className="animate-reveal stagger-3 xl:col-span-3"
        >
          <PartView
            part={view.reminder}
            label={`${meta.label.toLowerCase()} reminders`}
            skeletonHeight="h-40"
          >
            {(reminder) => <ReminderView reminder={reminder} />}
          </PartView>
        </DashboardCard>

        <DashboardCard
          key={`list-${category}`}
          title={meta.listTitle}
          headingId="admin-list-heading"
          action={<PillLink href={meta.listHref}>View all</PillLink>}
          className="animate-reveal stagger-4 xl:col-span-3"
        >
          <PartView
            part={view.list}
            label={meta.listTitle.toLowerCase()}
            skeletonHeight="h-48"
          >
            {(items) => (
              <ItemList items={items} icon={ListIcon} empty={meta.listEmpty} />
            )}
          </PartView>
        </DashboardCard>

        <DashboardCard
          key={`people-${category}`}
          title={meta.peopleTitle}
          headingId="admin-people-heading"
          action={<PillLink href={meta.peopleHref}>View all</PillLink>}
          className="animate-reveal stagger-4 md:col-span-2 xl:col-span-5"
        >
          <PartView
            part={view.people}
            label={meta.peopleTitle.toLowerCase()}
            skeletonHeight="h-48"
          >
            {(rows) => <PeopleList rows={rows} empty={meta.peopleEmpty} />}
          </PartView>
        </DashboardCard>

        <DashboardCard
          key={`gauge-${category}`}
          title={meta.gaugeTitle}
          headingId="admin-gauge-heading"
          className="animate-reveal stagger-5 xl:col-span-4"
        >
          <PartView
            part={view.gauge}
            label={meta.gaugeTitle.toLowerCase()}
            skeletonHeight="h-48"
          >
            {(gauge) => <ProgressGauge data={gauge} label={meta.gaugeTitle} />}
          </PartView>
        </DashboardCard>

        <div
          key={`spotlight-${category}`}
          className="animate-reveal stagger-6 flex xl:col-span-3"
        >
          <SpotlightCard
            title={meta.spotlightTitle}
            spotlight={view.spotlight.data}
          >
            <PartView
              part={view.spotlight}
              label={meta.spotlightTitle.toLowerCase()}
              skeletonHeight="h-32"
            >
              {() => null}
            </PartView>
          </SpotlightCard>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="mx-auto w-full max-w-7xl space-y-5 pb-12"
      role="main"
      aria-label="Admin dashboard"
    >
      <DashboardHeader
        subtitle={`${title}. Plan, prioritize and track every module in one place.`}
        actions={
          <>
            {action && (
              <Button
                variant="primary"
                onClick={() => router.push(action.href)}
                className="gap-2 rounded-full px-5 py-2.5 font-semibold"
              >
                <action.icon className="h-4 w-4" aria-hidden="true" />
                {action.label}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => router.push(meta.href)}
              className="rounded-full border-sky-200 px-5 py-2.5 font-semibold text-[#0284c7] hover:bg-sky-50 dark:border-sky-800/60 dark:text-sky-300"
            >
              Open {meta.label}
            </Button>
          </>
        }
      />

      {tabs.length > 1 ? (
        <Tabs
          label="Dashboard modules"
          idPrefix="admin-dashboard"
          tabs={tabs.map((t) => ({ id: t.id, label: t.label }))}
          value={category}
          onChange={setPicked}
          className="animate-reveal stagger-1"
        >
          {content}
        </Tabs>
      ) : (
        content
      )}
    </div>
  );
}

function DashboardHeader({
  subtitle,
  actions,
}: {
  subtitle: string;
  actions: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 animate-reveal">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2.5 text-3xl font-semibold tracking-tight text-[#0a3271] sm:text-4xl dark:text-sky-100">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-135 from-blue-600 via-sky-500 to-cyan-400 text-white shadow-md shadow-sky-500/25"
          >
            <LayoutGrid className="h-5 w-5" />
          </span>
          Dashboard
        </h1>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          {subtitle}
        </p>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
      )}
    </header>
  );
}
