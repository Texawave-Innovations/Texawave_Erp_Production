"use client";

import { useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  Dialog,
  ErrorState,
  Select,
  Skeleton,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import {
  useEmployeeLocationPrivilege,
  useSetEmployeeLocationPrivilege,
} from "../hooks";
import { LOCATION_PRIVILEGE_WRITE } from "../permissions";
import { LOCATION_MODES, type LocationMode } from "../types";
import { usePermission } from "@/hooks/usePermission";
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
      <Card>
        <Skeleton className="h-10 w-full" />
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
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
            {employee.fullName} ({employee.employeeCode})
          </h2>
          <div className="mt-1 flex items-center gap-2">
            {privilege.mode ? (
              <StatusBadge
                label={MODE_LABELS[privilege.mode]}
                colorToken={privilege.mode === "OFFICE" ? "warning" : "success"}
              />
            ) : (
              <StatusBadge label="Not set (no restriction)" colorToken="gray" />
            )}
          </div>
        </div>
        {canWrite ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setPendingMode(privilege.mode ?? "OFFICE");
              setEditOpen(true);
            }}
          >
            Change
          </Button>
        ) : null}
      </div>

      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Set location privilege"
      >
        <div className="flex flex-col gap-4">
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            OFFICE requires the office network on check-in/out. REMOTE exempts
            the punch from that check.
          </p>
          <Select
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
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={setMutation.isPending}
            >
              Save
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
