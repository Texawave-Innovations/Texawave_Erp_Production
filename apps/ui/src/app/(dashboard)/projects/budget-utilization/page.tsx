"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Loader2,
  Receipt,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useProjects } from "@/features/projects/hooks";

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);
}

export default function BudgetUtilizationPage() {
  const { data: projectsData, isLoading } = useProjects({ limit: 100 });
  const [search, setSearch] = useState("");
  const [filterHealth, setFilterHealth] = useState("all");

  const projects = useMemo(
    () => projectsData?.data || [],
    [projectsData?.data],
  );

  const computedProjects = useMemo(() => {
    return projects.map((p) => {
      const price = Number(p.projectPrice) || 0;
      const actualCost = Number(p.actualCost) || 0;
      const expectedHours = Number(p.expectedHours) || 0;

      // Compute total logged hours across members or tasks
      let loggedHours = 0;
      if (p.members && Array.isArray(p.members)) {
        loggedHours = p.members.reduce(
          (acc, m) => acc + (Number(m.loggedHours) || 0),
          0,
        );
      }

      // Live EVM Earned Value: Logged Hours * (Project Price / Expected Hours)
      const earnedAmount =
        expectedHours > 0 ? (loggedHours * price) / expectedHours : 0;

      // Utilization %
      const utilizationPercent =
        price > 0 ? Math.round((actualCost / price) * 100) : 0;

      // Variance = Project Price - Actual Spend
      const variance = price - actualCost;
      const isOverBudget = variance < 0;

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
      };
    });
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return computedProjects.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.projectCode.toLowerCase().includes(search.toLowerCase()) ||
        (p.customerName &&
          p.customerName.toLowerCase().includes(search.toLowerCase()));

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
    const avgUtilization =
      totalContract > 0 ? Math.round((totalSpent / totalContract) * 100) : 0;

    return {
      totalContract,
      totalEarned,
      totalSpent,
      netVariance,
      avgUtilization,
    };
  }, [computedProjects]);

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Budget Utilization & EVM Financials
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Real-time Earned Value Management (EVM), budget variance alerts, and
            contract profitability.
          </p>
        </div>

        <Link
          href="/projects/expenses"
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
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
              Total Contract Portfolio
            </span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/40 dark:text-cyan-400">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
            {formatCurrency(aggregates.totalContract)}
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Combined project budget baseline
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Earned Value (EVM)
            </span>
            <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-cyan-600 dark:text-cyan-400">
            {formatCurrency(aggregates.totalEarned)}
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Revenue recognized via logged work
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Actual Spend Incurred
            </span>
            <div className="rounded-xl bg-rose-50 p-2 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-rose-600 dark:text-rose-400">
            {formatCurrency(aggregates.totalSpent)}
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            {aggregates.avgUtilization}% average budget consumed
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Net Budget Variance
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
            {aggregates.netVariance >= 0
              ? "Under Budget (Profitable)"
              : "Over Budget (Deficit)"}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects, client names, project codes..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2 pl-10 pr-4 text-xs text-gray-900 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-cyan-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterHealth}
            onChange={(e) => setFilterHealth(e.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            <option value="all">All Budget Statuses</option>
            <option value="under">Under Budget / Profitable</option>
            <option value="over">Over Budget Alert</option>
          </select>
        </div>
      </div>

      {/* Projects Financial Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
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
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600 dark:text-cyan-400" />
                  </td>
                </tr>
              ) : filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    No project records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredProjects.map((p) => {
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40"
                    >
                      <td className="py-3 pl-4 pr-3 font-semibold text-gray-900 dark:text-white">
                        <Link
                          href={`/projects/${p.id}`}
                          className="flex items-center gap-1.5 text-blue-600 hover:underline dark:text-cyan-400"
                        >
                          <span className="font-mono text-[11px]">
                            {p.projectCode}
                          </span>
                          <span className="text-gray-300 dark:text-gray-700">
                            •
                          </span>
                          <span>{p.name}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                        {p.customerName || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono font-bold text-gray-900 dark:text-white">
                        {formatCurrency(p.price)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-gray-600 dark:text-gray-400">
                        {p.loggedHours.toFixed(1)} /{" "}
                        {p.expectedHours.toFixed(1)}h
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono font-bold text-cyan-600 dark:text-cyan-400">
                        {formatCurrency(p.earnedAmount)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono font-bold text-gray-900 dark:text-white">
                        {formatCurrency(p.actualCost)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
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
                          <span className="font-mono text-[11px] font-bold text-gray-700 dark:text-gray-300">
                            {p.utilizationPercent}%
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-3 pl-3 pr-4 text-right">
                        <span
                          className={`inline-flex items-center gap-1 font-mono font-bold ${
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
