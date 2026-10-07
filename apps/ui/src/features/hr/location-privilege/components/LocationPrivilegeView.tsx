"use client";

import { useState } from "react";
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
 * is shown alongside it, since both screens exist under the same legacy
 * "Location Privilege" area.
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
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Location privilege
        </h1>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">
          Controls whether an employee's attendance punch must come from an
          office network address.
        </p>
      </div>

      <Card>
        <div className="flex flex-col gap-3">
          <Input
            type="search"
            aria-label="Search employees by name or code"
            placeholder="Search employees by name or code"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedEmployeeId(null);
            }}
          />

          {list.isPending ? (
            <Skeleton className="h-10 w-full" />
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
            <EmptyState
              title="No employees match this search"
              description="Try a different name or employee code."
            />
          ) : (
            <ul className="flex flex-col gap-1">
              {list.data.data.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedEmployeeId(e.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-theme-sm hover:bg-gray-50 dark:hover:bg-gray-800 ${
                      e.id === selectedEmployeeId
                        ? "bg-brand-50 dark:bg-brand-950"
                        : ""
                    }`}
                  >
                    <span className="font-medium">{e.fullName}</span>{" "}
                    <span className="text-gray-500 dark:text-gray-400">
                      ({e.employeeCode})
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {selectedEmployee ? (
        <EmployeePrivilegeCard employee={selectedEmployee} />
      ) : null}

      <OfficeNetworksCard />
    </div>
  );
}
