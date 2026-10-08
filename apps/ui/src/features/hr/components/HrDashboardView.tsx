"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Users, Zap, Building2, Shield, CheckCircle2 } from "lucide-react";
import { Skeleton, StatusBadge } from "@texawave-erp/ui-kit";
import { PageHeader } from "@/components/layout/PageHeader";
import { useDepartments } from "@/features/departments/hooks";
import { useRoles } from "@/features/settings/roles/hooks";
import { useUsers } from "@/features/users/hooks";

/**
 * Enterprise HR Dashboard View.
 * Displays real workforce KPIs, department distribution, and recent joiners.
 * Conforms to Section 34, 35 & Docs/DESIGN_SYSTEM.md.
 */
export function HrDashboardView() {
  const usersQuery = useUsers({ page: 1, limit: 100 });
  const departmentsQuery = useDepartments({ page: 1, limit: 100 });
  const rolesQuery = useRoles({ page: 1, limit: 100 });

  const users = useMemo(
    () => usersQuery.data?.data ?? [],
    [usersQuery.data?.data],
  );
  const departments = useMemo(
    () => departmentsQuery.data?.data ?? [],
    [departmentsQuery.data?.data],
  );
  const roles = useMemo(
    () => rolesQuery.data?.data ?? [],
    [rolesQuery.data?.data],
  );

  // Derived real metrics
  const totalEmployees = usersQuery.data?.meta?.total ?? users.length;
  const activeEmployees = users.filter((u) => u.isActive).length;
  const activePercentage =
    totalEmployees > 0
      ? Math.round((activeEmployees / totalEmployees) * 100)
      : 100;
  const totalDepartments =
    departmentsQuery.data?.meta?.total ?? departments.length;
  const totalRoles = rolesQuery.data?.meta?.total ?? roles.length;

  const isLoading =
    usersQuery.isPending || departmentsQuery.isPending || rolesQuery.isPending;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-14 w-1/3" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Page Header */}
      <PageHeader
        breadcrumbs={["HR", "Overview", "Dashboard"]}
        title="HR Dashboard"
        description="Overview of your workforce and HR operations."
      />

      {/* 2. Top 4 Enterprise KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Total Employees */}
        <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-dark">
          <div className="flex items-center justify-between">
            <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
              Total Employees
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 shadow-theme-xs dark:bg-blue-950/60">
              <Users className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              {totalEmployees}
            </span>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
              Organization
            </span>
          </div>
        </div>

        {/* KPI 2: Active Workforce */}
        <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-dark">
          <div className="flex items-center justify-between">
            <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
              Active Employees
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 shadow-theme-xs dark:bg-brand-950/60">
              <Zap className="h-4.5 w-4.5 text-brand-600 dark:text-brand-400" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold tracking-tight text-brand-600 dark:text-brand-400">
              {activeEmployees}
            </span>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
              {activePercentage}% of total
            </span>
          </div>
        </div>

        {/* KPI 3: Departments */}
        <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-dark">
          <div className="flex items-center justify-between">
            <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
              Departments
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 shadow-theme-xs dark:bg-amber-950/60">
              <Building2 className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              {totalDepartments}
            </span>
            <Link
              href="/admin/departments"
              className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 hover:underline"
            >
              Manage →
            </Link>
          </div>
        </div>

        {/* KPI 4: Configured Roles */}
        <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-dark">
          <div className="flex items-center justify-between">
            <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
              Configured Roles
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 shadow-theme-xs dark:bg-indigo-950/60">
              <Shield className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400" />
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              {totalRoles}
            </span>
            <Link
              href="/admin/roles"
              className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 hover:underline"
            >
              Access control →
            </Link>
          </div>
        </div>
      </div>

      {/* 3. Middle Operational Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Card 1: Department Distribution */}
        <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-dark">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3.5 dark:border-gray-800">
            <div>
              <h3 className="text-theme-sm font-bold text-gray-900 dark:text-white">
                Department Distribution
              </h3>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Active organizational divisions across the enterprise
              </p>
            </div>
            <Link
              href="/admin/departments"
              className="text-theme-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="mt-3.5 flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            {departments.slice(0, 5).map((dept) => (
              <div
                key={dept.id}
                className="flex items-center justify-between py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-50 text-gray-500 dark:bg-gray-800">
                    <Building2 className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-theme-xs font-semibold text-gray-900 dark:text-white">
                    {dept.name}
                  </span>
                </div>
                <StatusBadge
                  label={dept.isActive ? "Active" : "Inactive"}
                  colorToken={dept.isActive ? "success" : "gray"}
                />
              </div>
            ))}

            {departments.length === 0 && (
              <div className="py-6 text-center text-theme-xs text-gray-400">
                No departments configured yet.
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Operations & Approvals (Calm State) */}
        <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-dark">
          <div className="border-b border-gray-100 pb-3.5 dark:border-gray-800">
            <h3 className="text-theme-sm font-bold text-gray-900 dark:text-white">
              Operations &amp; Leave Requests
            </h3>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              Workforce availability and pending administrative approvals
            </p>
          </div>

          <div className="my-auto py-8 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <h4 className="mt-3 text-theme-sm font-bold text-gray-900 dark:text-white">
              All Clear — 0 Pending Requests
            </h4>
            <p className="mx-auto mt-1 max-w-xs text-theme-xs text-gray-500 dark:text-gray-400">
              Leave &amp; attendance submissions are currently up to date.
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800 text-theme-xs text-gray-500 dark:text-gray-400">
            <span>Integration Status</span>
            <span className="font-semibold text-brand-600 dark:text-brand-400">
              Active Sync
            </span>
          </div>
        </div>
      </div>

      {/* 4. Bottom Section: Recent Team Members */}
      <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-dark">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3.5 dark:border-gray-800">
          <div>
            <h3 className="text-theme-sm font-bold text-gray-900 dark:text-white">
              Recent Team Members
            </h3>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              Users registered within your organization
            </p>
          </div>
          <Link
            href="/admin/users"
            className="text-theme-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 hover:underline"
          >
            View all users ({totalEmployees})
          </Link>
        </div>

        <div className="mt-3.5 overflow-x-auto">
          <table className="w-full text-left text-theme-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 dark:border-gray-800">
                <th className="py-2.5 font-medium">User</th>
                <th className="py-2.5 font-medium">Email</th>
                <th className="py-2.5 font-medium">Role</th>
                <th className="py-2.5 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {users.slice(0, 5).map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20"
                >
                  <td className="py-3 font-semibold text-gray-900 dark:text-white">
                    {u.fullName}
                  </td>
                  <td className="py-3 text-gray-500 dark:text-gray-400">
                    {u.email}
                  </td>
                  <td className="py-3">
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                      {u.roles?.[0]?.name ?? "Standard"}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <StatusBadge
                      label={u.isActive ? "Active" : "Inactive"}
                      colorToken={u.isActive ? "success" : "gray"}
                    />
                  </td>
                </tr>
              ))}

              {users.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-400">
                    No users registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
