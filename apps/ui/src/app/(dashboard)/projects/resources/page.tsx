"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Award,
  Clock,
  ListTodo,
  Loader2,
  Search,
  TrendingUp,
  Users2,
} from "lucide-react";
import { useResourceTracking } from "@/features/projects/hooks";

export default function ResourcesPage() {
  const { data: tracking, isLoading } = useResourceTracking();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const resources = useMemo(
    () => tracking?.resources || [],
    [tracking?.resources],
  );

  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      const matchSearch =
        r.employeeName.toLowerCase().includes(search.toLowerCase()) ||
        r.employeeCode.toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === "all" || r.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [resources, search, statusFilter]);

  const totalActiveTasks = useMemo(() => {
    return resources.reduce(
      (acc, curr) => acc + (curr.activeTasksCount || 0),
      0,
    );
  }, [resources]);

  const totalLoggedHours = useMemo(() => {
    return resources.reduce((acc, curr) => acc + (curr.loggedHours || 0), 0);
  }, [resources]);

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Resource Capacity & Allocation Tracker
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Workload distribution across engineering teams, 160h standard
            monthly capacity monitoring, and utilization.
          </p>
        </div>

        <Link
          href="/projects/points-master"
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <Award className="h-4 w-4 text-amber-500" />
          View Points Leaderboard
        </Link>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Active Resources
            </span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/40 dark:text-cyan-400">
              <Users2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
            {tracking?.activeEngineersCount || 0}
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Assigned project contributors
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Team Utilization Rate
            </span>
            <div className="rounded-xl bg-cyan-50 p-2 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-cyan-600 dark:text-cyan-400">
            {tracking?.overallUtilizationPercent || 0}%
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Active task allocation load
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              In-Progress Tasks
            </span>
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
              <ListTodo className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
            {totalActiveTasks}
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Concurrently active packages
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Total Logged Hours
            </span>
            <div className="rounded-xl bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {totalLoggedHours.toFixed(1)}h
          </div>
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Cumulative stopwatch tracking
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
            placeholder="Search contributor name or employee code..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2 pl-10 pr-4 text-xs text-gray-900 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-cyan-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            <option value="all">All Workloads</option>
            <option value="NORMAL">Normal Load</option>
            <option value="OVER_CAPACITY">Over Capacity</option>
            <option value="UNDER_UTILIZED">Available Capacity</option>
          </select>
        </div>
      </div>

      {/* Resource Allocation Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60 text-gray-500 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
                <th className="py-3 pl-4 pr-3 font-bold">Team Member</th>
                <th className="px-3 py-3 font-bold">Code</th>
                <th className="px-3 py-3 font-bold">Active Tasks</th>
                <th className="px-3 py-3 font-bold">Logged Hours</th>
                <th className="min-w-[180px] px-3 py-3 font-bold">
                  Monthly Capacity (160h Base)
                </th>
                <th className="px-3 py-3 font-bold">Workload Status</th>
                <th className="py-3 pl-3 pr-4 text-right font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-600 dark:text-cyan-400" />
                  </td>
                </tr>
              ) : filteredResources.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    No resource records found.
                  </td>
                </tr>
              ) : (
                filteredResources.map((res) => {
                  const logged = Number(res.loggedHours) || 0;
                  const capacityPct = Math.min(
                    100,
                    Math.round((logged / (res.baseCapacityHours || 160)) * 100),
                  );
                  const isOverallocated = res.status === "OVER_CAPACITY";
                  const isOptimal = res.status === "NORMAL";

                  return (
                    <tr
                      key={res.employeeId}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-800/40"
                    >
                      <td className="py-3 pl-4 pr-3 font-semibold text-gray-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-cyan-300">
                            {res.employeeName.slice(0, 1).toUpperCase()}
                          </div>
                          <span>{res.employeeName}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-gray-500 dark:text-gray-400">
                        {res.employeeCode}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-gray-900 dark:text-white">
                          <ListTodo className="h-3 w-3 text-blue-500" />
                          {res.activeTasksCount} tasks
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-gray-700 dark:text-gray-300">
                        {logged.toFixed(1)} /{" "}
                        {(res.baseCapacityHours || 160).toFixed(1)}h
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isOverallocated
                                  ? "bg-rose-500"
                                  : isOptimal
                                    ? "bg-gradient-to-r from-blue-600 to-cyan-500"
                                    : "bg-blue-400"
                              }`}
                              style={{ width: `${capacityPct}%` }}
                            />
                          </div>
                          <span className="font-mono text-[11px] font-bold text-gray-600 dark:text-gray-400">
                            {capacityPct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {isOverallocated ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                            High Workload
                          </span>
                        ) : isOptimal ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                            Optimal Load
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/40 dark:text-cyan-400">
                            Available Capacity
                          </span>
                        )}
                      </td>
                      <td className="py-3 pl-3 pr-4 text-right">
                        <Link
                          href="/projects/list"
                          className="text-xs font-semibold text-blue-600 hover:underline dark:text-cyan-400"
                        >
                          View Work
                        </Link>
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
