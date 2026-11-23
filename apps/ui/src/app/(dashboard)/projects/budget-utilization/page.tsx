"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  IndianRupee,
  Receipt,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionCard,
  Select,
  SpringGlideSegmentedControl,
  StatCard,
  StatusBadge,
  TableSkeleton,
  TableToolbar,
  type DataTableColumn,
} from "@texawave-erp/ui-kit";
import { useProjects } from "@/features/projects/hooks";
import { ProjectMeter } from "@/features/projects/components/ProjectMeter";
import {
  formatCurrency,
  formatDate,
  percent,
  toDateInput,
} from "@/features/projects/format";

type PnlView = "monthly" | "yearly";

const PNL_VIEWS = [
  { id: "monthly", label: "Monthly View" },
  { id: "yearly", label: "Yearly View" },
] as const;

export default function BudgetUtilizationPage() {
  // MAX_PAGE_SIZE on the API is 100 — the financial roll-up covers the 100
  // most recent projects.
  const projectsQuery = useProjects({ limit: 100 });
  const [search, setSearch] = useState("");
  const [filterHealth, setFilterHealth] = useState("all");
  const [pnlView, setPnlView] = useState<PnlView>("monthly");

  const projects = useMemo(
    () => projectsQuery.data?.data ?? [],
    [projectsQuery.data],
  );

  const computedProjects = useMemo(() => {
    return projects.map((p) => {
      const price = Number(p.projectPrice) || 0;
      const actualCost = Number(p.actualCost) || 0;
      const expectedHours = Number(p.expectedHours) || 0;

      // `GET /projects` already enriches each row with totalLoggedHours and
      // earnedAmount (EVM: hoursLogged × price / expectedHours); fall back to
      // the same formula from members if an older payload lacks them.
      const loggedHours =
        p.totalLoggedHours ??
        (p.members ?? []).reduce(
          (acc, m) => acc + (Number(m.loggedHours) || 0),
          0,
        );
      const earnedAmount =
        p.earnedAmount ??
        (expectedHours > 0 ? (loggedHours * price) / expectedHours : 0);

      const utilizationPercent =
        price > 0 ? Math.round((actualCost / price) * 100) : 0;
      const variance = price - actualCost;
      const isOverBudget = variance < 0;
      const earnedProgressPct = percent(earnedAmount, price);
      const completedDate =
        toDateInput(p.actualEndDate) || toDateInput(p.plannedEndDate) || "";

      return {
        ...p,
        price,
        actualCost,
        expectedHours,
        loggedHours,
        earnedAmount,
        utilizationPercent,
        variance,
        isOverBudget,
        earnedProgressPct,
        completedDate,
      };
    });
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return computedProjects.filter((p) => {
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.projectCode.toLowerCase().includes(q) ||
        (p.customerName ?? "").toLowerCase().includes(q);
      const matchHealth =
        filterHealth === "all" ||
        (filterHealth === "over" && p.isOverBudget) ||
        (filterHealth === "under" && !p.isOverBudget);
      return matchSearch && matchHealth;
    });
  }, [computedProjects, search, filterHealth]);

  const aggregates = useMemo(() => {
    let totalContract = 0;
    let totalEarned = 0;
    let totalSpent = 0;
    for (const p of computedProjects) {
      totalContract += p.price;
      totalEarned += p.earnedAmount;
      totalSpent += p.actualCost;
    }
    const netVariance = totalContract - totalSpent;
    return {
      totalContract,
      totalEarned,
      totalSpent,
      netVariance,
      avgUtilization:
        totalContract > 0 ? Math.round((totalSpent / totalContract) * 100) : 0,
      netReturnPct:
        totalContract > 0 ? Math.round((netVariance / totalContract) * 100) : 0,
    };
  }, [computedProjects]);

  // Legacy P&L: revenue = contract price, expense = actual spend, bucketed by
  // completion (actual end, else planned end, else today) month or year.
  const pnlData = useMemo(() => {
    const buckets = new Map<
      string,
      { revenue: number; expense: number; profit: number }
    >();
    const today = new Date().toISOString().slice(0, 10);
    for (const p of computedProjects) {
      const day = p.completedDate || today;
      const key = pnlView === "monthly" ? day.slice(0, 7) : day.slice(0, 4);
      const b = buckets.get(key) ?? { revenue: 0, expense: 0, profit: 0 };
      b.revenue += p.price;
      b.expense += p.actualCost;
      b.profit += p.price - p.actualCost;
      buckets.set(key, b);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([label, v]) => ({ label, ...v }));
  }, [computedProjects, pnlView]);

  const completedProjects = computedProjects.filter(
    (p) => p.status === "completed",
  );

  const formatPeriod = (label: string) => {
    if (pnlView === "yearly") return label;
    const [y, m] = label.split("-").map(Number);
    if (!y || !m) return label;
    return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  const isLoading = projectsQuery.isPending;
  const isError = projectsQuery.isError;

  type Computed = (typeof computedProjects)[number];

  const projectCell = (p: Computed) => (
    <div className="min-w-0">
      <p className="text-theme-xs font-semibold text-brand-700 dark:text-cyan-300">
        {p.projectCode}
      </p>
      <Link
        href={`/projects/${p.id}`}
        className="block font-semibold text-gray-900 hover:text-brand-700 hover:underline dark:text-white/90 dark:hover:text-cyan-300"
      >
        {p.name}
      </Link>
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
        {p.customerName || p.salesCustomer?.companyName || "—"}
      </p>
    </div>
  );

  const varianceBadge = (p: Computed) => (
    <StatusBadge
      label={`${p.variance >= 0 ? "+" : "−"}${formatCurrency(Math.abs(p.variance))}`}
      colorToken={p.variance >= 0 ? "success" : "error"}
    />
  );

  const budgetColumns: DataTableColumn<Computed>[] = [
    { header: "Project", cell: projectCell },
    {
      header: "Contract Budget",
      cell: (p) => (
        <span className="whitespace-nowrap font-semibold">
          {formatCurrency(p.price)}
        </span>
      ),
    },
    {
      header: "Logged / Est. Hours",
      cell: (p) => (
        <span className="whitespace-nowrap">
          {p.loggedHours.toFixed(1)} / {p.expectedHours.toFixed(1)}h
        </span>
      ),
    },
    {
      header: "EVM Earned Value",
      cell: (p) => (
        <span className="whitespace-nowrap font-semibold text-brand-700 dark:text-cyan-300">
          {formatCurrency(p.earnedAmount)}
        </span>
      ),
    },
    {
      header: "Actual Expenses",
      cell: (p) => (
        <span className="whitespace-nowrap font-semibold">
          {formatCurrency(p.actualCost)}
        </span>
      ),
    },
    {
      header: "Budget Utilization",
      cell: (p) => (
        <ProjectMeter
          label={`Budget used for ${p.name}`}
          used={formatCurrency(p.actualCost)}
          total={`/ ${formatCurrency(p.price)}`}
          pct={p.utilizationPercent}
          className="min-w-44"
        />
      ),
    },
    {
      header: "Variance / Profit",
      align: "right",
      cell: (p) => (
        <span className="inline-flex items-center gap-1.5">
          {p.isOverBudget ? (
            <TrendingDown className="h-3.5 w-3.5 text-error-600 dark:text-rose-400" />
          ) : (
            <TrendingUp className="h-3.5 w-3.5 text-success-600 dark:text-emerald-400" />
          )}
          {varianceBadge(p)}
        </span>
      ),
    },
  ];

  const archiveColumns: DataTableColumn<Computed>[] = [
    { header: "Project", cell: projectCell },
    {
      header: "Completed On",
      cell: (p) => (
        <span className="whitespace-nowrap">{formatDate(p.completedDate)}</span>
      ),
    },
    {
      header: "Final Price",
      cell: (p) => (
        <span className="whitespace-nowrap font-semibold">
          {formatCurrency(p.price)}
        </span>
      ),
    },
    {
      header: "Actual vs Expected Hours",
      cell: (p) => (
        <span className="whitespace-nowrap">
          <span className="font-semibold text-brand-700 dark:text-cyan-300">
            {p.loggedHours.toFixed(1)}h
          </span>{" "}
          / {p.expectedHours.toFixed(1)}h
        </span>
      ),
    },
    {
      header: "Total Expenses",
      cell: (p) => (
        <span className="whitespace-nowrap font-semibold">
          {formatCurrency(p.actualCost)}
        </span>
      ),
    },
    {
      header: "Net Variance / Profit",
      align: "right",
      cell: varianceBadge,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="banner"
        icon={IndianRupee}
        title="Budget & Financial Utilization"
        description="Real-time earned value progress, expense variance & consolidated Profit & Loss performance"
        action={
          <Link href="/projects/expenses">
            <Button variant="glass">
              <Receipt className="h-4 w-4" /> View Expense Vouchers
            </Button>
          </Link>
        }
      />

      {/* KPI Financial Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          headingId="prj-bud-contract"
          label="Total Contract Value"
          value={formatCurrency(aggregates.totalContract)}
          note="Contracted project revenue"
          tone="blue"
          icon={IndianRupee}
        />
        <StatCard
          headingId="prj-bud-earned"
          label="Earned Value (Live)"
          value={formatCurrency(aggregates.totalEarned)}
          note="Hours logged × rate"
          tone="cyan"
          icon={TrendingUp}
        />
        <StatCard
          headingId="prj-bud-spent"
          label="Actual Expenses Spent"
          value={formatCurrency(aggregates.totalSpent)}
          note={`${aggregates.avgUtilization}% of total budget`}
          tone="amber"
          icon={Receipt}
        />
        <StatCard
          headingId="prj-bud-margin"
          label="Net Profit Margin"
          value={formatCurrency(aggregates.netVariance)}
          note={`${aggregates.netReturnPct}% net return · ${aggregates.netVariance >= 0 ? "Under budget" : "Over budget"}`}
          tone={aggregates.netVariance >= 0 ? "success" : "error"}
          icon={aggregates.netVariance >= 0 ? CheckCircle2 : AlertTriangle}
        />
      </div>

      {/* 1. Live earned progress per project */}
      <SectionCard
        title="Live Earned Progress vs Contract Price"
        description="amountEarned = hoursLogged × (projectPrice / expectedHours), compared with projectPrice"
      >
        {isLoading ? (
          <TableSkeleton rowsCount={3} columnsCount={3} />
        ) : isError ? (
          <ErrorState
            title="Could not load project financials"
            onRetry={() => projectsQuery.refetch()}
          />
        ) : computedProjects.length === 0 ? (
          <EmptyState title="No projects recorded yet" />
        ) : (
          <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {computedProjects.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-2 rounded-xl border border-gray-100 p-4 dark:border-gray-800"
              >
                {projectCell(p)}
                <ProjectMeter
                  label={`${p.name} earned progress`}
                  used={`Earned ${formatCurrency(p.earnedAmount)}`}
                  total={`/ ${formatCurrency(p.price)}`}
                  pct={p.earnedProgressPct}
                />
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {p.loggedHours.toFixed(1)}h logged of{" "}
                  {p.expectedHours.toFixed(1)}h
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* 2. Profit & Loss performance */}
      <SectionCard
        title="Profit & Loss Performance"
        description="Profit = projectPrice − actual expenses, grouped by completion (actual or planned end) period"
        action={
          <SpringGlideSegmentedControl
            options={PNL_VIEWS}
            value={pnlView}
            onChange={setPnlView}
            ariaLabel="Profit and loss period"
          />
        }
      >
        {isLoading ? (
          <TableSkeleton rowsCount={2} columnsCount={3} />
        ) : pnlData.length === 0 ? (
          <EmptyState title="No financial periods to show yet" />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {pnlData.map((item) => (
              <div
                key={item.label}
                className="flex flex-col gap-3 rounded-xl border border-gray-100 p-4 dark:border-gray-800"
              >
                <div className="flex items-center justify-between">
                  <span className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">
                    {formatPeriod(item.label)}
                  </span>
                  <StatusBadge
                    label={item.profit >= 0 ? "Profit" : "Loss"}
                    colorToken={item.profit >= 0 ? "success" : "error"}
                  />
                </div>
                <dl className="flex flex-col gap-1 text-theme-sm">
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <dt>Revenue</dt>
                    <dd className="font-semibold text-gray-900 dark:text-white/90">
                      {formatCurrency(item.revenue)}
                    </dd>
                  </div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <dt>Expenses</dt>
                    <dd className="font-semibold text-gray-900 dark:text-white/90">
                      {formatCurrency(item.expense)}
                    </dd>
                  </div>
                  <div className="flex justify-between border-t border-gray-100 pt-2 font-semibold dark:border-gray-800">
                    <dt className="text-gray-800 dark:text-gray-200">
                      Net Margin
                    </dt>
                    <dd
                      className={
                        item.profit >= 0
                          ? "text-success-700 dark:text-emerald-400"
                          : "text-error-700 dark:text-rose-400"
                      }
                    >
                      {formatCurrency(item.profit)}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* 3. Project budget table (search + over/under filter) */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-dark">
        <div className="border-b border-gray-100 p-4 dark:border-gray-800">
          <TableToolbar
            search={{
              value: search,
              onChange: setSearch,
              onClear: () => setSearch(""),
              placeholder: "Search projects, client names, project codes...",
              ariaLabel: "Search projects",
            }}
            resultCount={isLoading ? undefined : filteredProjects.length}
            hasActiveFilters={search !== "" || filterHealth !== "all"}
            onClearFilters={() => {
              setSearch("");
              setFilterHealth("all");
            }}
            filters={
              <Select
                aria-label="Filter by budget status"
                value={filterHealth}
                onChange={(e) => setFilterHealth(e.target.value)}
              >
                <option value="all">All Budget Statuses</option>
                <option value="under">Under Budget / Profitable</option>
                <option value="over">Over Budget Alert</option>
              </Select>
            }
          />
        </div>
        {isError ? (
          <div className="p-6">
            <ErrorState
              title="Could not load project financials"
              onRetry={() => projectsQuery.refetch()}
            />
          </div>
        ) : (
          <DataTable
            columns={budgetColumns}
            rows={filteredProjects}
            getRowKey={(p) => String(p.id)}
            caption="Project budgets"
            loading={isLoading}
            loadingRowsCount={6}
            emptyState={
              <div className="py-10">
                <EmptyState title="No project records found matching your filters." />
              </div>
            }
          />
        )}
      </div>

      {/* 4. Completed projects financial archive */}
      <SectionCard
        title="Completed Projects Financial Archive"
        description="Historical contract price, actual vs expected hours, expenses total & net variance"
      >
        <DataTable
          columns={archiveColumns}
          rows={completedProjects}
          getRowKey={(p) => String(p.id)}
          caption="Completed projects"
          loading={isLoading}
          loadingRowsCount={3}
          emptyState={
            <div className="py-8">
              <EmptyState title="No completed projects archived yet." />
            </div>
          }
        />
      </SectionCard>
    </div>
  );
}
