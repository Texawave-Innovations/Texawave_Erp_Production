"use client";

import { useState } from "react";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Globe2,
  Info,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  Dialog,
  ErrorState,
  FormField,
  Select,
  Skeleton,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import {
  useEmployeeLocationPrivilege,
  useSetEmployeeLocationPrivilege,
} from "../hooks";
import { LOCATION_PRIVILEGE_WRITE } from "../permissions";
import { LOCATION_MODES, type LocationMode } from "../types";
import type { EmployeeListItem } from "../../employees/types";

const MODE_LABELS: Record<LocationMode, string> = {
  OFFICE: "Office (network required)",
  REMOTE: "Remote (no network check)",
};

/**
 * Shows and edits one employee's location privilege. The API tracks this
 * per employee, not as a list, so the view requires picking an employee
 * first (see `LocationPrivilegeView`).
 */
export function EmployeePrivilegeCard({
  employee,
}: {
  employee: EmployeeListItem;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<LocationMode>("OFFICE");
  const { toast } = useToast();

  const canWrite = usePermission(LOCATION_PRIVILEGE_WRITE);
  const query = useEmployeeLocationPrivilege(employee.id);
  const setMutation = useSetEmployeeLocationPrivilege();

  if (query.isPending) {
    return (
      <Card className="p-5">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-8 w-2/3 rounded-lg" />
        </div>
      </Card>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isPermissionError) {
      return (
        <Alert
          variant="warning"
          title="You don't have access to location privilege"
        >
          Ask an administrator for the <code>hr.location_privilege.read</code>{" "}
          permission.
        </Alert>
      );
    }
    if (error instanceof ApiError && error.isNotFound) {
      return (
        <Alert variant="error" title="Employee not found">
          This employee could not be found in your organization.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const privilege = query.data;

  async function handleSave() {
    try {
      await setMutation.mutateAsync({
        employeeId: employee.id,
        mode: pendingMode,
      });
      setEditOpen(false);
      toast({ title: "Location privilege updated", variant: "success" });
    } catch (error) {
      if (error instanceof ApiError && error.isPermissionError) {
        toast({
          title: "You may not change your own location privilege",
          variant: "error",
        });
      } else {
        toast({
          title: "Could not update location privilege",
          variant: "error",
        });
      }
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-5">
        {/* Card Header: Employee Identity & Action */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <EmployeeIdentity
              name={employee.fullName}
              code={employee.employeeCode}
              subtext={employee.designation?.name}
              avatarSize="md"
              size="md"
            />
          </div>

          <div className="flex items-center gap-2.5">
            <div>
              {privilege.mode ? (
                <StatusBadge
                  label={MODE_LABELS[privilege.mode]}
                  colorToken={
                    privilege.mode === "OFFICE" ? "warning" : "success"
                  }
                />
              ) : (
                <StatusBadge
                  label="Not set (no restriction)"
                  colorToken="gray"
                />
              )}
            </div>

            {canWrite ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setPendingMode(privilege.mode ?? "OFFICE");
                  setEditOpen(true);
                }}
                className="h-8 px-3 text-theme-xs font-medium inline-flex items-center gap-1.5 shadow-2xs"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Change
              </Button>
            ) : null}
          </div>
        </div>

        {/* Policy Explanation Banner */}
        <div
          className={`rounded-xl p-4 border transition-all ${
            privilege.mode === "OFFICE"
              ? "bg-amber-50/70 border-amber-200/80 text-amber-900 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-200"
              : privilege.mode === "REMOTE"
                ? "bg-emerald-50/70 border-emerald-200/80 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-900/60 dark:text-emerald-200"
                : "bg-gray-50/80 border-gray-200/70 text-gray-800 dark:bg-gray-900/60 dark:border-gray-800 dark:text-gray-300"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {privilege.mode === "OFFICE" ? (
                <Building2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              ) : privilege.mode === "REMOTE" ? (
                <Globe2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Info className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              )}
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-theme-sm font-semibold">
                {privilege.mode === "OFFICE"
                  ? "Office Network Restriction Active"
                  : privilege.mode === "REMOTE"
                    ? "Remote Check-In Exemption Active"
                    : "No Specific Restriction Configured"}
              </h3>
              <p className="text-theme-xs leading-relaxed opacity-90">
                {privilege.mode === "OFFICE"
                  ? "Attendance punches (check-in and check-out) for this employee must originate from an authorized IP address registered in Office Networks below."
                  : privilege.mode === "REMOTE"
                    ? "This employee is exempt from office network verification. Attendance check-ins and check-outs are accepted from any external or remote network."
                    : "This employee does not currently have a location constraint assigned. Check-ins are permitted from any network by default."}
              </p>
            </div>
          </div>
        </div>

        {/* Policy Details / Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="rounded-lg bg-gray-50/70 dark:bg-gray-800/40 p-3 border border-gray-100 dark:border-gray-800">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              Department / Team
            </span>
            <p className="text-theme-xs font-semibold text-gray-900 dark:text-white mt-0.5 truncate">
              {employee.team?.name ?? "General Staff"}
            </p>
          </div>

          <div className="rounded-lg bg-gray-50/70 dark:bg-gray-800/40 p-3 border border-gray-100 dark:border-gray-800">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              Privilege Assignment
            </span>
            <p className="text-theme-xs font-semibold text-gray-900 dark:text-white mt-0.5">
              {privilege.source === "explicit"
                ? "Explicit Rule"
                : "Default Policy"}
            </p>
          </div>

          <div className="rounded-lg bg-gray-50/70 dark:bg-gray-800/40 p-3 border border-gray-100 dark:border-gray-800">
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              Last Updated
            </span>
            <p className="text-theme-xs font-semibold text-gray-900 dark:text-white mt-0.5">
              {privilege.updatedAt
                ? new Intl.DateTimeFormat("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(privilege.updatedAt))
                : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Change Privilege Modal */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Set location privilege"
        size="md"
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900/60">
            <EmployeeIdentity
              name={employee.fullName}
              code={employee.employeeCode}
              avatarSize="sm"
              size="sm"
            />
          </div>

          <p className="text-theme-sm text-gray-500 dark:text-gray-400 -mt-1">
            Choose whether punches for this employee require an office network
            address.
          </p>

          <FormField
            label="Location mode"
            required
            hint="Controls punch location enforcement on check-in and check-out."
          >
            {(f) => (
              <Select
                {...f}
                aria-label="Location mode"
                value={pendingMode}
                onChange={(e) => setPendingMode(e.target.value as LocationMode)}
              >
                {LOCATION_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {MODE_LABELS[mode]}
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          {/* Interactive Option Cards */}
          <div className="grid grid-cols-1 gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setPendingMode("OFFICE")}
              className={`rounded-lg p-3 text-left transition-all border flex items-start gap-3 ${
                pendingMode === "OFFICE"
                  ? "border-amber-500/80 bg-amber-50/60 dark:border-amber-600 dark:bg-amber-950/40"
                  : "border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700 bg-transparent"
              }`}
            >
              <div className="mt-0.5 rounded-full p-1 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-theme-xs font-semibold text-gray-900 dark:text-white">
                  Office (network required)
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  Attendance punch only succeeds when connected to a configured
                  office IP.
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPendingMode("REMOTE")}
              className={`rounded-lg p-3 text-left transition-all border flex items-start gap-3 ${
                pendingMode === "REMOTE"
                  ? "border-emerald-500/80 bg-emerald-50/60 dark:border-emerald-600 dark:bg-emerald-950/40"
                  : "border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700 bg-transparent"
              }`}
            >
              <div className="mt-0.5 rounded-full p-1 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                <Globe2 className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-theme-xs font-semibold text-gray-900 dark:text-white">
                  Remote (no network check)
                </span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  Exempt from network restrictions. Punches allowed from any
                  location.
                </span>
              </div>
            </button>
          </div>

          <div className="flex justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-gray-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditOpen(false)}
              disabled={setMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={setMutation.isPending}
              loading={setMutation.isPending}
            >
              Save
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
