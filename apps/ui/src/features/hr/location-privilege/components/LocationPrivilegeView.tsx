"use client";

import { useState } from "react";
import { ChevronRight, Search, ShieldCheck, Users, X } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { useDebouncedValue, useEmployees } from "../../employees/hooks";
import { READ_ANY_SCOPE } from "../../employees/permissions";
import { LOCATION_PRIVILEGE_READ } from "../permissions";
import { EmployeePrivilegeCard } from "./EmployeePrivilegeCard";
import { OfficeNetworksCard } from "./OfficeNetworksCard";

const PAGE_SIZE = 10;

/**
 * Location Privilege has no "list all employees' privileges" API — it is
 * per-employee (`GET/PUT /hr/location-privileges/employees/:id`), so the
 * screen first searches the employee directory (reusing `hr/employees`'
 * search) and then shows/edits the selected employee's privilege. The
 * organization's office network allowlist (a real, separate list endpoint)
 * is shown alongside it.
 */
export function LocationPrivilegeView() {
  const [search, setSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(
    null,
  );
  const debouncedSearch = useDebouncedValue(search.trim());

  const canReadEmployees = usePermission(READ_ANY_SCOPE);
  const canReadPrivilege = usePermission(LOCATION_PRIVILEGE_READ);

  const list = useEmployees({
    page: 1,
    limit: PAGE_SIZE,
    sortBy: "fullName",
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  });

  const selectedEmployee = list.data?.data.find(
    (e) => e.id === selectedEmployeeId,
  );

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
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-theme-xl font-bold tracking-tight text-gray-900 dark:text-white">
            Location privilege
          </h1>
        </div>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Manage office-network restrictions for employee attendance check-ins.
        </p>
      </div>

      {/* Main Grid: Left = Employee Selector, Right = Selected Privilege Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Employee Directory Column */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <Card className="p-4">
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  <h2 className="text-theme-sm font-semibold text-gray-900 dark:text-white">
                    Employee Directory
                  </h2>
                </div>
                {list.data ? (
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                    {list.data.meta.total} employees
                  </span>
                ) : null}
              </div>

              {/* Search input */}
              <div className="relative">
                <Input
                  type="search"
                  aria-label="Search employees by name or code"
                  placeholder="Search employees by name or code"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedEmployeeId(null);
                  }}
                  className="pl-9 pr-8"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                {search ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setSelectedEmployeeId(null);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              {/* Search Results / Directory List */}
              {list.isPending ? (
                <div className="flex flex-col gap-2 pt-1">
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : list.isError ? (
                list.error instanceof ApiError &&
                list.error.isPermissionError ? (
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
                <div className="py-6">
                  <EmptyState
                    title="No employees match this search"
                    description="Try a different name or employee code."
                  />
                </div>
              ) : (
                <ul
                  className="flex flex-col gap-1.5 max-h-105 overflow-y-auto pr-0.5"
                  role="list"
                >
                  {list.data.data.map((e) => {
                    const isSelected = e.id === selectedEmployeeId;
                    return (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedEmployeeId(e.id)}
                          className={`group w-full rounded-lg px-3 py-2.5 text-left text-theme-sm transition-all duration-150 flex items-center justify-between gap-3 border ${
                            isSelected
                              ? "border-brand-300 bg-brand-50/80 shadow-xs dark:border-brand-700/60 dark:bg-brand-950/70"
                              : "border-gray-100 hover:border-gray-200 hover:bg-gray-50/80 dark:border-gray-800/60 dark:hover:border-gray-700 dark:hover:bg-gray-800/50"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <EmployeeIdentity
                              name={e.fullName}
                              code={e.employeeCode}
                              subtext={e.designation?.name}
                              avatarSize="sm"
                              size="sm"
                            />
                          </div>
                          <ChevronRight
                            className={`h-4 w-4 shrink-0 transition-transform ${
                              isSelected
                                ? "text-brand-600 dark:text-brand-400 translate-x-0.5"
                                : "text-gray-300 dark:text-gray-600 group-hover:text-gray-500"
                            }`}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
        </div>

        {/* Selected Employee Privilege Details Column */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {selectedEmployee ? (
            <EmployeePrivilegeCard employee={selectedEmployee} />
          ) : (
            <Card className="flex flex-col items-center justify-center py-16 px-6 text-center border-dashed border-gray-200 dark:border-gray-800">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400 border border-brand-100 dark:border-brand-900 mb-3.5">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-theme-sm font-semibold text-gray-900 dark:text-white">
                Select an Employee
              </h3>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400 max-w-sm mt-1">
                Choose an employee from the directory on the left to view and
                modify their attendance location restrictions.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Office Networks Section (Full width) */}
      <OfficeNetworksCard />
    </div>
  );
}
