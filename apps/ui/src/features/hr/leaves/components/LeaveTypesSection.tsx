"use client";

import { useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import {
  useCreateLeaveType,
  useLeaveTypes,
  useSetLeaveTypeActive,
  useUpdateLeaveType,
} from "../hooks";
import { LEAVE_TYPE_READ, LEAVE_TYPE_WRITE } from "../permissions";
import type {
  CreateLeaveTypeFormValues,
  UpdateLeaveTypeFormValues,
} from "../schema";
import type { LeaveTypeItem } from "../types";
import { LeaveTypeForm } from "./LeaveTypeForm";
import { SetEntitlementDialog } from "./SetEntitlementDialog";

const PAGE_SIZE = 10;

/**
 * Leave type administration + per-employee entitlement overrides — the
 * production equivalent of legacy's "Leave Allotment" tab
 * (TexaWave_ERP `src/modules/hr/LeaveAllotment.tsx`). The backend
 * (hr/leave-types, hr/leave-entitlements) has carried this capability since
 * the HR_LEAVE.md design phase; this is its first UI.
 */
export function LeaveTypesSection() {
  const canRead = usePermission(LEAVE_TYPE_READ);
  const canWrite = usePermission(LEAVE_TYPE_WRITE);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveTypeItem | null>(null);
  const [settingEntitlement, setSettingEntitlement] =
    useState<LeaveTypeItem | null>(null);
  const { toast } = useToast();

  const list = useLeaveTypes({ page, limit: PAGE_SIZE });
  const createMutation = useCreateLeaveType();
  const updateMutation = useUpdateLeaveType();
  const activeMutation = useSetLeaveTypeActive();

  if (!canRead) return null;

  async function handleCreate(
    values: CreateLeaveTypeFormValues | UpdateLeaveTypeFormValues,
  ) {
    const v = values as CreateLeaveTypeFormValues;
    try {
      await createMutation.mutateAsync({
        code: v.code,
        name: v.name,
        ...(v.description ? { description: v.description } : {}),
        isPaid: v.isPaid,
        annualEntitlement: v.annualEntitlement,
        carryForwardLimit: v.carryForwardLimit,
      });
      setCreateOpen(false);
      toast({ title: "Leave type created", variant: "success" });
    } catch (err) {
      toast({
        title:
          err instanceof ApiError ? err.message : "Could not create leave type",
        variant: "error",
      });
    }
  }

  async function handleUpdate(
    values: CreateLeaveTypeFormValues | UpdateLeaveTypeFormValues,
  ) {
    if (!editing) return;
    const v = values as UpdateLeaveTypeFormValues;
    try {
      await updateMutation.mutateAsync({
        id: editing.id,
        body: {
          name: v.name,
          // An empty description clears it (API: "Send an empty string to clear").
          description: v.description ?? "",
          isPaid: v.isPaid,
          annualEntitlement: v.annualEntitlement,
          carryForwardLimit: v.carryForwardLimit,
        },
      });
      setEditing(null);
      toast({ title: "Leave type updated", variant: "success" });
    } catch (err) {
      toast({
        title:
          err instanceof ApiError ? err.message : "Could not update leave type",
        variant: "error",
      });
    }
  }

  async function handleToggleActive(type: LeaveTypeItem) {
    const nextActive = !type.isActive;
    try {
      await activeMutation.mutateAsync({ id: type.id, isActive: nextActive });
      toast({
        title: `${nextActive ? "Activated" : "Deactivated"} "${type.name}"`,
        variant: "success",
      });
    } catch (err) {
      toast({
        title:
          err instanceof ApiError
            ? err.message
            : `Could not update "${type.name}"`,
        variant: "error",
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-theme-lg font-semibold text-gray-900 dark:text-white/90">
          Leave types
        </h2>
        {canWrite ? (
          <Button onClick={() => setCreateOpen(true)}>New leave type</Button>
        ) : null}
      </div>

      {list.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : list.isError ? (
        list.error instanceof ApiError && list.error.isPermissionError ? (
          <Alert variant="warning" title="You don't have access to leave types">
            Your access to this list has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void list.refetch()} />
        )
      ) : list.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title="No leave types yet"
            description={
              canWrite
                ? "Create a leave type (e.g. Casual, Sick) before employees can request paid leave."
                : "Ask HR to configure leave types."
            }
          />
        </Card>
      ) : (
        <>
          <DataTable<LeaveTypeItem>
            caption="Leave types"
            rows={list.data.data}
            getRowKey={(t) => String(t.id)}
            columns={[
              { header: "Code", cell: (t) => t.code },
              { header: "Name", cell: (t) => t.name },
              {
                header: "Paid",
                cell: (t) => (t.isPaid ? "Paid" : "Unpaid"),
              },
              {
                header: "Annual entitlement",
                cell: (t) => `${t.annualEntitlement} days`,
              },
              {
                header: "Carry-forward limit",
                cell: (t) => `${t.carryForwardLimit} days`,
              },
              {
                header: "Status",
                cell: (t) => (
                  <StatusBadge
                    label={t.isActive ? "Active" : "Inactive"}
                    colorToken={t.isActive ? "success" : "gray"}
                  />
                ),
              },
              ...(canWrite
                ? [
                    {
                      header: "",
                      headerClassName: "sr-only",
                      className: "text-right",
                      cell: (t: LeaveTypeItem) => (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSettingEntitlement(t)}
                            aria-label={`Set entitlement for ${t.name}`}
                          >
                            Set entitlement
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(t)}
                            aria-label={`Edit ${t.name}`}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleToggleActive(t)}
                            aria-label={`${t.isActive ? "Deactivate" : "Activate"} ${t.name}`}
                          >
                            {t.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
          />
          <Pagination
            page={list.data.meta.page}
            totalPages={list.data.meta.totalPages}
            onPageChange={setPage}
          />
        </>
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New leave type"
      >
        <LeaveTypeForm
          mode="create"
          onSubmit={handleCreate}
          onCancel={() => setCreateOpen(false)}
          submitLabel="Create leave type"
        />
      </Dialog>

      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit leave type"
      >
        {editing ? (
          <LeaveTypeForm
            mode="edit"
            initialValues={{
              name: editing.name,
              description: editing.description ?? "",
              isPaid: editing.isPaid,
              annualEntitlement: editing.annualEntitlement,
              carryForwardLimit: editing.carryForwardLimit,
            }}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
            submitLabel="Save changes"
          />
        ) : null}
      </Dialog>

      {settingEntitlement ? (
        <SetEntitlementDialog
          open
          onClose={() => setSettingEntitlement(null)}
          leaveType={settingEntitlement}
        />
      ) : null}
    </div>
  );
}
