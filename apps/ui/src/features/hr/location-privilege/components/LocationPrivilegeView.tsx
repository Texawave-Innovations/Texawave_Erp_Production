"use client";

import { useState } from "react";
import { Building2, MapPin, Users, Wifi } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  EmptyState,
  ErrorState,
  Pagination,
  SearchInput,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { HrPageHeader } from "@/features/hr/components";
import { useDebouncedValue, useEmployees } from "../../employees/hooks";
import { READ_ANY_SCOPE } from "../../employees/permissions";
import {
  LOCATION_PRIVILEGE_READ,
  LOCATION_PRIVILEGE_WRITE,
} from "../permissions";
import { EmployeeAccessControlRow } from "./EmployeeAccessControlRow";
import { OfficeNetworksCard } from "./OfficeNetworksCard";

const PAGE_SIZE = 15;

/**
 * Location Privilege:
 * - Executive access control view matching the reference UI.
 * - Top legend cards explaining Office vs Remote modes.
 * - Direct 1-click interactive segmented toggles per employee for seamless access control.
 * - Office networks IP allowlist section below.
 */
export function LocationPrivilegeView() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());

  const canReadEmployees = usePermission(READ_ANY_SCOPE);
  const canReadPrivilege = usePermission(LOCATION_PRIVILEGE_READ);
  const canWritePrivilege = usePermission(LOCATION_PRIVILEGE_WRITE);

  const list = useEmployees({
    page,
    limit: PAGE_SIZE,
    sortBy: "fullName",
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  });

  if (!canReadEmployees || !canReadPrivilege) {
    return (
      <Alert
        variant="warning"
        title="You don't have access to location privilege"
      >
        Ask an administrator for the <code>hr.location_privilege.read</code> and{" "}
        <code>hr.employee.read</code> permissions.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Page Header */}
      <HrPageHeader
        title="Location Privilege"
        description="Control where each employee can access the portal — Office (desktop only) or Remote (mobile allowed)."
        icon={MapPin}
        badge={
          list.data ? (
            <span className="rounded-full bg-white/20 backdrop-blur-xs px-3.5 py-1 text-xs font-bold text-white shadow-xs">
              {list.data.meta.total} Employees
            </span>
          ) : null
        }
      />

      {/* 2. Mode Explanation / Legend Cards (Exact match to Reference UI) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Office Mode Card */}
        <div className="flex items-center gap-3.5 rounded-2xl border border-sky-200/80 bg-linear-to-r from-[#edf6ff] to-[#f0f8ff] p-4 shadow-xs dark:border-sky-900/40 dark:from-slate-900 dark:to-slate-800">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-300/80 bg-white text-brand-500 shadow-xs dark:border-sky-800 dark:bg-slate-800 dark:text-sky-300">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                Office Access
              </h3>
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10.5px] font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                Network required
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Desktop access only · Attendance restricted to configured office IP networks
            </p>
          </div>
        </div>

        {/* Remote Mode Card */}
        <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-200/80 bg-linear-to-r from-[#f0fdf4] to-[#ecfdf5] p-4 shadow-xs dark:border-emerald-900/40 dark:from-slate-900 dark:to-slate-800">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-300/80 bg-white text-emerald-600 shadow-xs dark:border-emerald-800 dark:bg-slate-800 dark:text-emerald-300">
            <Wifi className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                Remote Access
              </h3>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Mobile allowed
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Mobile & desktop allowed · Punches permitted from any location / network
            </p>
          </div>
        </div>
      </div>

      {/* 3. Employee Access Control Section */}
      <div className="relative z-20 focus-within:z-30 rounded-2xl border border-sky-100/90 bg-white/95 p-5 shadow-2xs backdrop-blur-md dark:border-sky-950/40 dark:bg-gray-900/90">
        <div className="flex flex-col gap-4">
          {/* Header & Search Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
            <div>
              <div className="flex items-center gap-2">
                <Users className="h-4.5 w-4.5 text-brand-600 dark:text-brand-400" />
                <h2 className="text-theme-base font-bold text-gray-900 dark:text-white">
                  Employee Access Control
                </h2>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Toggle each employee between Office and Remote attendance mode in one click
              </p>
            </div>

            <div className="w-full sm:w-80">
              <SearchInput
                placeholder="Search employees by name, code or department..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                onClear={() => {
                  setSearch("");
                  setPage(1);
                }}
                className="w-full"
              />
            </div>
          </div>

          {/* Employee Access Rows Feed */}
          {list.isPending ? (
            <div className="flex flex-col gap-2.5 pt-1">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : list.isError ? (
            list.error instanceof ApiError && list.error.isPermissionError ? (
              <Alert
                variant="warning"
                title="You don't have access to employees"
              >
                Ask an administrator for the <code>hr.employee.read</code>{" "}
                permission.
              </Alert>
            ) : (
              <ErrorState onRetry={() => void list.refetch()} />
            )
          ) : list.data.data.length === 0 ? (
            <div className="py-8">
              <EmptyState
                title="No employees match this search"
                description="Try a different employee name, code, or department."
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {list.data.data.map((employee) => (
                <EmployeeAccessControlRow
                  key={employee.id}
                  employee={employee}
                  canWrite={canWritePrivilege}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {list.data && list.data.meta.totalPages > 1 && (
            <div className="pt-2">
              <Pagination
                page={page}
                totalPages={list.data.meta.totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      </div>

      {/* 4. Office Networks Allowlist Section */}
      <OfficeNetworksCard />
    </div>
  );
}
