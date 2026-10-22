"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
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

export function LeaveTypesSection() {
  const canRead = usePermission(LEAVE_TYPE_READ);
  const canWrite = usePermission(LEAVE_TYPE_WRITE);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"ALL" | "ACTIVE" | "PAID" | "UNPAID">("ALL");

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveTypeItem | null>(null);
  const [settingEntitlement, setSettingEntitlement] =
    useState<LeaveTypeItem | null>(null);
  const { toast } = useToast();

  // Load all leave types for instant search & metrics
  const list = useLeaveTypes({ page: 1, limit: 100 });
  const allTypes = list.data?.data ?? [];

  const createMutation = useCreateLeaveType();
  const updateMutation = useUpdateLeaveType();
  const activeMutation = useSetLeaveTypeActive();

  // Metrics computation
  const stats = useMemo(() => {
    const total = allTypes.length;
    const active = allTypes.filter((t) => t.isActive).length;
    const paid = allTypes.filter((t) => t.isPaid).length;
    const carryForward = allTypes.filter((t) => t.carryForwardLimit > 0).length;
    return { total, active, paid, carryForward };
  }, [allTypes]);

  // Filter & Search
  const filteredTypes = useMemo(() => {
    return allTypes.filter((t) => {
      if (filterMode === "ACTIVE" && !t.isActive) return false;
      if (filterMode === "PAID" && !t.isPaid) return false;
      if (filterMode === "UNPAID" && t.isPaid) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const codeMatch = t.code.toLowerCase().includes(q);
        const nameMatch = t.name.toLowerCase().includes(q);
        const descMatch = (t.description ?? "").toLowerCase().includes(q);
        if (!codeMatch && !nameMatch && !descMatch) return false;
      }
      return true;
    });
  }, [allTypes, filterMode, searchQuery]);

  const totalPages = Math.ceil(filteredTypes.length / PAGE_SIZE) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredTypes.slice(start, start + PAGE_SIZE);
  }, [filteredTypes, page]);

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
        approvalLevels: v.approvalLevels,
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
          description: v.description ?? "",
          isPaid: v.isPaid,
          annualEntitlement: v.annualEntitlement,
          carryForwardLimit: v.carryForwardLimit,
          approvalLevels: v.approvalLevels,
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
    <div className="flex flex-col gap-5">
      {/* 4 Executive KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Leave Types */}
        <div className="flex items-center justify-between rounded-2xl border border-sky-200/80 bg-linear-to-r from-[#f0f9ff] to-[#e0f2fe] p-4 shadow-xs dark:border-sky-900/40 dark:from-slate-900 dark:to-slate-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300">
              Total Categories
            </p>
            <h3 className="mt-1 text-2xl font-extrabold text-sky-900 dark:text-white">
              {stats.total}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Configured leave quotas
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-300/80 bg-white text-brand-500 shadow-xs dark:border-sky-800 dark:bg-slate-800 dark:text-sky-300">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        {/* Active Types */}
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200/80 bg-linear-to-r from-[#f0fdf4] to-[#ecfdf5] p-4 shadow-xs dark:border-emerald-900/40 dark:from-slate-900 dark:to-slate-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Active Types
            </p>
            <h3 className="mt-1 text-2xl font-extrabold text-emerald-900 dark:text-white">
              {stats.active}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Open for employee requests
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/80 bg-white text-emerald-600 shadow-xs dark:border-emerald-800 dark:bg-slate-800 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        {/* Paid Leaves */}
        <div className="flex items-center justify-between rounded-2xl border border-amber-200/80 bg-linear-to-r from-[#fffbeb] to-[#fef3c7] p-4 shadow-xs dark:border-amber-900/40 dark:from-slate-900 dark:to-slate-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Paid Leave
            </p>
            <h3 className="mt-1 text-2xl font-extrabold text-amber-800 dark:text-white">
              {stats.paid}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              With salary compensation
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-300/80 bg-white text-amber-600 shadow-xs dark:border-amber-800 dark:bg-slate-800 dark:text-amber-300">
            <Wallet className="h-5 w-5" />
          </div>
        </div>

        {/* Carry Forward Enabled */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-linear-to-r from-slate-50 to-slate-100/70 p-4 shadow-xs dark:border-slate-800 dark:from-slate-900 dark:to-slate-800">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Carry Forward
            </p>
            <h3 className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
              {stats.carryForward}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Annual rollover limit enabled
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-300/80 bg-white text-slate-600 shadow-xs dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
            <RotateCcw className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Executive Control Toolbar */}
      <div className="relative z-20 focus-within:z-30 rounded-2xl border border-sky-100/90 bg-white/95 p-4 shadow-2xs backdrop-blur-md dark:border-sky-950/40 dark:bg-gray-900/90">
        <div className="flex flex-col gap-3.5 md:flex-row md:items-center md:justify-between">
          {/* Left: Search input */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search leave code or name…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-10 text-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/70 p-1 text-xs dark:border-slate-800 dark:bg-slate-800/60">
              <button
                type="button"
                onClick={() => {
                  setFilterMode("ALL");
                  setPage(1);
                }}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-all cursor-pointer ${
                  filterMode === "ALL"
                    ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                All ({allTypes.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterMode("ACTIVE");
                  setPage(1);
                }}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-all cursor-pointer ${
                  filterMode === "ACTIVE"
                    ? "bg-white text-emerald-700 shadow-2xs dark:bg-slate-700 dark:text-emerald-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Active ({stats.active})
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterMode("PAID");
                  setPage(1);
                }}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-all cursor-pointer ${
                  filterMode === "PAID"
                    ? "bg-white text-amber-700 shadow-2xs dark:bg-slate-700 dark:text-amber-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Paid ({stats.paid})
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterMode("UNPAID");
                  setPage(1);
                }}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-all cursor-pointer ${
                  filterMode === "UNPAID"
                    ? "bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Unpaid ({allTypes.length - stats.paid})
              </button>
            </div>
          </div>

          {/* Right: Primary Action */}
          {canWrite ? (
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              <span>New leave type</span>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Main Content Area */}
      {list.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
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
      ) : filteredTypes.length === 0 ? (
        <div className="rounded-2xl border border-sky-100/90 bg-white/95 p-8 text-center shadow-2xs backdrop-blur-md dark:border-sky-950/40 dark:bg-gray-900/90">
          <EmptyState
            title={
              searchQuery || filterMode !== "ALL"
                ? "No matching leave types"
                : "No leave types yet"
            }
            description={
              searchQuery || filterMode !== "ALL"
                ? "Try searching for a different keyword or resetting your filter."
                : "Create standard leave types (e.g. Annual, Sick, Casual) so employees can request leaves."
            }
            action={
              searchQuery || filterMode !== "ALL" ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterMode("ALL");
                  }}
                >
                  Reset filters
                </Button>
              ) : canWrite ? (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  New leave type
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        /* Reference-Matching Leave Types Table */
        <div className="flex flex-col gap-4">
          <DataTable<LeaveTypeItem>
            caption="Leave types list"
            rows={paginatedRows}
            getRowKey={(t) => String(t.id)}
            columns={[
              {
                header: "Code",
                cell: (t) => (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-sky-50 text-brand-500 border border-sky-200/80 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800">
                    {t.code}
                  </span>
                ),
              },
              {
                header: "Leave Type",
                cell: (t) => (
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-900 dark:text-white">
                      {t.name}
                    </span>
                    {t.description ? (
                      <span
                        className="max-w-xs truncate text-[11px] text-gray-500 dark:text-gray-400 mt-0.5"
                        title={t.description}
                      >
                        {t.description}
                      </span>
                    ) : null}
                  </div>
                ),
              },
              {
                header: "Days / Year",
                cell: (t) => (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                    {t.annualEntitlement} days
                  </span>
                ),
              },
              {
                header: "Carry Forward",
                cell: (t) =>
                  t.carryForwardLimit > 0 ? (
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      Yes (Max {t.carryForwardLimit}d)
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      No
                    </span>
                  ),
              },
              {
                header: "Paid / Unpaid",
                cell: (t) => (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                      t.isPaid
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {t.isPaid ? "Paid" : "Unpaid"}
                  </span>
                ),
              },
              {
                header: "Approval Flow",
                cell: (t) => (
                  <span className="text-xs text-slate-600 dark:text-slate-300">
                    {t.approvalLevels === 2 ? "2 Levels (Manager + HR)" : "1 Level (Manager)"}
                  </span>
                ),
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
                      header: "Actions",
                      className: "text-right",
                      cell: (t: LeaveTypeItem) => (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSettingEntitlement(t)}
                            aria-label={`Set entitlement for ${t.name}`}
                            title={`Set entitlement for ${t.name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:border-brand-500 hover:bg-sky-50 hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-sky-400 dark:hover:bg-slate-700 dark:hover:text-sky-300 cursor-pointer"
                          >
                            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(t)}
                            aria-label={`Edit ${t.name}`}
                            title={`Edit ${t.name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors hover:border-brand-500 hover:bg-sky-50 hover:text-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-sky-400 dark:hover:bg-slate-700 dark:hover:text-sky-300 cursor-pointer"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleActive(t)}
                            aria-label={`${t.isActive ? "Deactivate" : "Activate"} ${t.name}`}
                            title={`${t.isActive ? "Deactivate" : "Activate"} ${t.name}`}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 cursor-pointer ${
                              t.isActive
                                ? "border-rose-200 bg-white text-rose-600 hover:border-rose-300 hover:bg-rose-50 dark:border-rose-900/40 dark:bg-gray-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
                                : "border-emerald-200 bg-white text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-gray-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                            }`}
                          >
                            {t.isActive ? (
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
          />

          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

      {/* Dialogs */}
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
              approvalLevels: editing.approvalLevels === 2 ? 2 : 1,
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
