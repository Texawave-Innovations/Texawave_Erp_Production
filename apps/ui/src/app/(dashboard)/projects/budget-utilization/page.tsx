"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  IndianRupee,
  Receipt,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  EmptyState,
  ErrorState,
  SearchInput,
  SpringGlideSegmentedControl,
  TableSkeleton,
} from "@texawave-erp/ui-kit";
import { useProjects } from "@/features/projects/hooks";
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

  return (
    <div className="flex flex-col gap-6">
      {/* Header banner */}
      <div className="relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-3xl border border-sky-200/60 bg-gradient-to-r from-[#0a3271] via-[#1769F5] to-[#12CFE3] p-6 text-white shadow-lg shadow-blue-500/10 dark:border-sky-900/40">
        <div>
          <div className="mb-1.5 flex items-center gap-3">
            <span className="rounded-2xl border border-white/20 bg-white/15 p-2.5 backdrop-blur-md">
              <IndianRupee className="h-6 w-6" />
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Budget &amp; Financial Utilization
            </h1>
          </div>
          <p className="pl-1 text-xs text-cyan-50/90 sm:text-sm">
            Real-time earned value progress, expense variance &amp; consolidated
            Profit &amp; Loss performance
          </p>
        </div>
        <Link
          href="/projects/expenses"
          className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-white px-4 py-2.5 text-xs font-bold text-brand-700 shadow-md transition-colors hover:bg-sky-50 dark:bg-gray-900 dark:text-cyan-300 dark:hover:bg-gray-800"
        >
          <Receipt className="h-4 w-4" />
          View Expense Vouchers
        </Link>
      </div>

      {/* KPI Financial Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Total Contract Value
            </span>
            <div className="rounded-xl bg-sky-50 p-2 text-brand-600 dark:bg-sky-950/40 dark:text-cyan-400">
              <IndianRupee className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
            {formatCurrency(aggregates.totalContract)}
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Contracted project revenue
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Earned Value (Live)
            </span>
            <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-cyan-600 dark:text-cyan-400">
            {formatCurrency(aggregates.totalEarned)}
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Hours logged × rate
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Actual Expenses Spent
            </span>
            <div className="rounded-xl bg-rose-50 p-2 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-rose-600 dark:text-rose-400">
            {formatCurrency(aggregates.totalSpent)}
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            {aggregates.avgUtilization}% of total budget
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Net Profit Margin
            </span>
            <div
              className={`rounded-xl p-2 ${
                aggregates.netVariance >= 0
                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
              }`}
            >
              {aggregates.netVariance >= 0 ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
            </div>
          </div>
          <div
            className={`mt-2 text-2xl font-extrabold ${
              aggregates.netVariance >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {formatCurrency(aggregates.netVariance)}
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            {aggregates.netReturnPct}% net return ·{" "}
            {aggregates.netVariance >= 0 ? "Under budget" : "Over budget"}
          </p>
        </div>
      </div>

      {/* 1. Live earned progress per project */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            Live Earned Progress vs Contract Price
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Formula: amountEarned = hoursLogged × (projectPrice / expectedHours)
            vs projectPrice
          </p>
        </div>
        <div className="flex flex-col gap-3 p-5">
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
            computedProjects.map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-gray-50/70 p-4 transition-colors hover:bg-sky-50/40 dark:border-gray-800 dark:bg-gray-800/30 dark:hover:bg-gray-800/60"
              >
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black text-brand-700 dark:text-cyan-400">
                      {p.projectCode}
                    </span>
                    <Link
                      href={`/projects/${p.id}`}
                      className="text-sm font-bold text-gray-900 hover:text-brand-600 hover:underline dark:text-white dark:hover:text-cyan-400"
                    >
                      {p.name}
                    </Link>
                    <span className="text-[11px] font-semibold text-gray-400">
                      • {p.customerName || p.customer?.name || "Client"}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-extrabold text-cyan-700 dark:text-cyan-400">
                      Earned: {formatCurrency(p.earnedAmount)}
                    </span>
                    <span className="text-gray-400">/</span>
                    <span className="font-bold text-gray-700 dark:text-gray-300">
                      Target: {formatCurrency(p.price)}
                    </span>
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-black text-brand-700 dark:bg-sky-950/50 dark:text-cyan-300">
                      {p.earnedProgressPct}% Earned
                    </span>
                  </div>
                </div>
                <div
                  className="relative h-4 overflow-hidden rounded-full border border-gray-200 bg-gray-200/80 dark:border-gray-700 dark:bg-gray-800"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={p.earnedProgressPct}
                  aria-label={`${p.name} earned progress`}
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#1769F5] to-[#12CFE3] transition-all duration-700 motion-reduce:transition-none"
                    style={{ width: `${p.earnedProgressPct}%` }}
                  />
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-black text-gray-800 dark:text-white">
                    {p.loggedHours.toFixed(1)}h logged of{" "}
                    {p.expectedHours.toFixed(1)}h ({p.earnedProgressPct}%)
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* 2. Profit & Loss performance */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center dark:border-gray-800">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
              <BarChart3 className="h-5 w-5 text-brand-600 dark:text-cyan-400" />
              Profit &amp; Loss Performance
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Profit = projectPrice − actual expenses, grouped by completion
              (actual or planned end) period
            </p>
          </div>
          <SpringGlideSegmentedControl
            options={PNL_VIEWS}
            value={pnlView}
            onChange={setPnlView}
            ariaLabel="Profit and loss period"
          />
        </div>
        <div className="p-5">
          {isLoading ? (
            <TableSkeleton rowsCount={2} columnsCount={3} />
          ) : pnlData.length === 0 ? (
            <EmptyState title="No financial periods to show yet" />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {pnlData.map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-gray-50/80 p-5 dark:border-gray-800 dark:bg-gray-800/30"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-gray-700 dark:text-gray-300">
                      {formatPeriod(item.label)}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-black ${
                        item.profit >= 0
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                      }`}
                    >
                      {item.profit >= 0 ? "+ Profit" : "− Loss"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 text-xs">
                    <div className="flex justify-between font-semibold text-gray-600 dark:text-gray-400">
                      <span>Revenue:</span>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {formatCurrency(item.revenue)}
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold text-gray-600 dark:text-gray-400">
                      <span>Expenses:</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">
                        {formatCurrency(item.expense)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-2 text-sm font-black dark:border-gray-700">
                      <span className="text-gray-800 dark:text-gray-200">
                        Net Margin:
                      </span>
                      <span
                        className={
                          item.profit >= 0
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-rose-700 dark:text-rose-400"
                        }
                      >
                        {formatCurrency(item.profit)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 3. Project budget table (search + over/under filter) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="min-w-[240px] flex-1">
          <SearchInput
            value={search}
            onChangeValue={setSearch}
            onClear={() => setSearch("")}
            clearable
            sizeVariant="sm"
            placeholder="Search projects, client names, project codes..."
            aria-label="Search projects"
          />
        </div>
        <select
          aria-label="Filter by budget status"
          value={filterHealth}
          onChange={(e) => setFilterHealth(e.target.value)}
          className="rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          <option value="all">All Budget Statuses</option>
          <option value="under">Under Budget / Profitable</option>
          <option value="over">Over Budget Alert</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <TableSkeleton rowsCount={6} columnsCount={8} className="p-4" />
        ) : isError ? (
          <ErrorState
            title="Could not load project financials"
            onRetry={() => projectsQuery.refetch()}
          />
        ) : filteredProjects.length === 0 ? (
          <EmptyState title="No project records found matching your filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
                  <th className="py-3 pl-4 pr-3 font-bold">Project</th>
                  <th className="px-3 py-3 font-bold">Client</th>
                  <th className="px-3 py-3 font-bold">Contract Budget</th>
                  <th className="px-3 py-3 font-bold">Logged / Est. Hours</th>
                  <th className="px-3 py-3 font-bold">EVM Earned Value</th>
                  <th className="px-3 py-3 font-bold">Actual Expenses</th>
                  <th className="min-w-[170px] px-3 py-3 font-bold">
                    Budget Utilization
                  </th>
                  <th className="py-3 pl-3 pr-4 text-right font-bold">
                    Variance / Profit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredProjects.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40"
                  >
                    <td className="py-3 pl-4 pr-3 font-semibold text-gray-900 dark:text-white">
                      <Link
                        href={`/projects/${p.id}`}
                        className="flex items-center gap-1.5 text-brand-600 hover:underline dark:text-cyan-400"
                      >
                        <span className="text-[11px]">{p.projectCode}</span>
                        <span className="text-gray-300 dark:text-gray-700">
                          •
                        </span>
                        <span>{p.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                      {p.customerName || p.customer?.name || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-bold text-gray-900 dark:text-white">
                      {formatCurrency(p.price)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-gray-600 dark:text-gray-400">
                      {p.loggedHours.toFixed(1)} / {p.expectedHours.toFixed(1)}h
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-bold text-cyan-600 dark:text-cyan-400">
                      {formatCurrency(p.earnedAmount)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-bold text-gray-900 dark:text-white">
                      {formatCurrency(p.actualCost)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                          <div
                            className={`h-full rounded-full transition-all duration-300 motion-reduce:transition-none ${
                              p.isOverBudget
                                ? "bg-rose-500"
                                : p.utilizationPercent > 80
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                            }`}
                            style={{
                              width: `${Math.min(100, p.utilizationPercent)}%`,
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                          {p.utilizationPercent}%
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap py-3 pl-3 pr-4 text-right">
                      <span
                        className={`inline-flex items-center gap-1 font-bold ${
                          p.isOverBudget
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {p.isOverBudget ? (
                          <TrendingDown className="h-3.5 w-3.5" />
                        ) : (
                          <TrendingUp className="h-3.5 w-3.5" />
                        )}
                        {formatCurrency(p.variance)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Completed projects financial archive */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">
            Completed Projects Financial Archive
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Historical contract price, actual vs expected hours, expenses total
            &amp; net variance
          </p>
        </div>
        {isLoading ? (
          <TableSkeleton rowsCount={3} columnsCount={6} className="p-4" />
        ) : completedProjects.length === 0 ? (
          <EmptyState title="No completed projects archived yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
                  <th className="py-3 pl-4 pr-3 font-bold">Project / Code</th>
                  <th className="px-3 py-3 font-bold">Completed On</th>
                  <th className="px-3 py-3 font-bold">Final Price</th>
                  <th className="px-3 py-3 font-bold">
                    Actual vs Expected Hours
                  </th>
                  <th className="px-3 py-3 font-bold">Total Expenses</th>
                  <th className="py-3 pl-3 pr-4 text-right font-bold">
                    Net Variance / Profit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {completedProjects.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40"
                  >
                    <td className="py-3 pl-4 pr-3">
                      <Link
                        href={`/projects/${p.id}`}
                        className="block text-sm font-bold text-brand-600 hover:underline dark:text-cyan-400"
                      >
                        {p.name}
                      </Link>
                      <span className="text-[10px] text-gray-400">
                        {p.projectCode} •{" "}
                        {p.customerName || p.customer?.name || "Client"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-gray-600 dark:text-gray-400">
                      {formatDate(p.completedDate)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-black text-gray-900 dark:text-white">
                      {formatCurrency(p.price)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <span className="font-extrabold text-brand-700 dark:text-cyan-400">
                        {p.loggedHours.toFixed(1)}h
                      </span>
                      <span className="font-semibold text-gray-400">
                        {" "}
                        / {p.expectedHours.toFixed(1)}h
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-bold text-rose-600 dark:text-rose-400">
                      {formatCurrency(p.actualCost)}
                    </td>
                    <td className="whitespace-nowrap py-3 pl-3 pr-4 text-right">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-black ${
                          p.variance >= 0
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300"
                        }`}
                      >
                        {p.variance >= 0 ? "+" : "−"}
                        {formatCurrency(Math.abs(p.variance))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
