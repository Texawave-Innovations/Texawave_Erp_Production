"use client";

import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Select,
  Skeleton,
  StatusBadge,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { ApiError } from "@texawave-erp/core";
import { HrPageHeader } from "@/features/hr/components";
import {
  Calendar,
  CheckCircle2,
  Clock,
  LogOut,
  Plus,
  X,
  XCircle,
} from "lucide-react";
import { useCreateMyExitRequest, useMyExitRequests } from "../hooks";
import type { MyExitRequest } from "../api";

const STATUS_TOKEN: Record<string, "success" | "warning" | "error" | "gray"> = {
  APPROVED: "success",
  SUBMITTED: "warning",
  REJECTED: "error",
};

const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Pending Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function NewExitRequestForm({ onClose }: { onClose: () => void }) {
  const createMutation = useCreateMyExitRequest();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [preferredLastWorkingDate, setPreferredLastWorkingDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createMutation.mutateAsync({ reason, preferredLastWorkingDate });
      toast({ title: "Exit request submitted", variant: "success" });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not submit this request. Check the fields and try again.",
      );
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="flex flex-col gap-4"
    >
      <FormField label="Reason for separation / leaving" required>
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            rows={4}
            placeholder="Please detail your reason for resigning or transition plans..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        )}
      </FormField>
      <FormField label="Preferred last working day" required>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            type="date"
            value={preferredLastWorkingDate}
            onChange={(e) => setPreferredLastWorkingDate(e.target.value)}
            required
          />
        )}
      </FormField>
      {error ? (
        <Alert variant="error" title="Submission failed">
          {error}
        </Alert>
      ) : null}
      <div className="flex justify-end gap-2 pt-2 border-t border-sky-100 dark:border-slate-800">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={createMutation.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" loading={createMutation.isPending}>
          Submit request
        </Button>
      </div>
    </form>
  );
}

export function MyExitRequestsView() {
  const query = useMyExitRequests();
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const rows = query.data ?? [];

  // Summary statistics across all requests (unfiltered)
  const summary = useMemo(() => {
    return {
      total: rows.length,
      SUBMITTED: rows.filter((r) => r.status === "SUBMITTED").length,
      APPROVED: rows.filter((r) => r.status === "APPROVED").length,
      REJECTED: rows.filter((r) => r.status === "REJECTED").length,
    };
  }, [rows]);

  // Filtered rows for display
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !r.reason.toLowerCase().includes(q) &&
          !r.preferredLastWorkingDate.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [rows, statusFilter, searchQuery]);

  const hasFilters = statusFilter !== "" || searchQuery !== "";

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4 animate-reveal">
        <div className="h-28 w-full rounded-2xl bg-sky-100/60 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isPermissionError) {
      return (
        <Alert variant="warning" title="You don't have access to exit requests">
          Ask an administrator for permission to access exit requests.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const metricCards = [
    {
      label: "Total Requests",
      value: summary.total.toString(),
      Icon: LogOut,
      color: "text-slate-600 bg-slate-100 dark:bg-slate-800",
      filterValue: "",
    },
    {
      label: "Pending Review",
      value: summary.SUBMITTED.toString(),
      Icon: Clock,
      color: "text-amber-500 bg-amber-50 dark:bg-amber-950/40",
      filterValue: "SUBMITTED",
    },
    {
      label: "Approved",
      value: summary.APPROVED.toString(),
      Icon: CheckCircle2,
      color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40",
      filterValue: "APPROVED",
    },
    {
      label: "Rejected",
      value: summary.REJECTED.toString(),
      Icon: XCircle,
      color: "text-rose-500 bg-rose-50 dark:bg-rose-950/40",
      filterValue: "REJECTED",
    },
  ];

  return (
    <div className="flex flex-col gap-6 animate-reveal pb-12">
      {/* 1. Standard Page Header with 3D Icon */}
      <HrPageHeader
        title="Exit Requests"
        description="Submit resignation notices, monitor separation approval milestones, and track your last working day."
        icon3d="exit-requests"
        action={
          <Button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-xl font-bold shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Submit request</span>
          </Button>
        }
      />

      {/* 2. Interactive Status Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((card, idx) => {
          const isSelected =
            card.filterValue !== "" && statusFilter === card.filterValue;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                if (card.filterValue) {
                  setStatusFilter((prev) =>
                    prev === card.filterValue ? "" : card.filterValue,
                  );
                }
              }}
              className={`flex items-center gap-3.5 rounded-2xl p-4 text-left transition-all ${
                card.filterValue ? "cursor-pointer" : "cursor-default"
              } ${
                isSelected
                  ? "border-2 border-brand-500 bg-sky-50/80 shadow-xs ring-2 ring-brand-500/15 dark:bg-slate-800"
                  : "border border-sky-200/90 bg-white hover:border-brand-300 hover:bg-sky-50/40 shadow-2xs dark:border-slate-700/80 dark:bg-slate-850"
              }`}
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.color}`}
              >
                <card.Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {card.label}
                </span>
                <span className="text-xl font-bold tracking-tight text-[#0a3271] dark:text-white">
                  {card.value}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3. Search & Filter Bar: Compact Single-Line Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-sky-200/90 bg-white p-3.5 shadow-2xs dark:border-slate-700/80 dark:bg-slate-850">
        <div className="w-full sm:w-72">
          <Input
            aria-label="Search requests"
            placeholder="Search by reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-52">
          <Select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="SUBMITTED">Pending Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </Select>
        </div>
        {hasFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("");
              setSearchQuery("");
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-red-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-red-400"
          >
            <X className="h-3.5 w-3.5" />
            <span>Clear filters</span>
          </Button>
        ) : null}
      </div>

      {/* 4. Content / Table */}
      {filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-sky-200/90 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <EmptyState
            title={hasFilters ? "No matching requests" : "No exit requests"}
            description={
              hasFilters
                ? "Try clearing the search or status filter to see all records."
                : "Your separation and exit requests will appear here once submitted."
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-sky-200/90 bg-white shadow-xs dark:border-slate-700/80 dark:bg-slate-900">
          <DataTable<MyExitRequest>
            className="border-0 shadow-none rounded-none"
            columns={[
              {
                header: "Reason for Leaving",
                cell: (row) => (
                  <div className="py-1">
                    <span className="font-bold text-[#0a3271] dark:text-white line-clamp-2">
                      {row.reason}
                    </span>
                  </div>
                ),
              },
              {
                header: "Preferred Last Day",
                cell: (row) => (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2f6396] dark:text-sky-300">
                    <Calendar className="h-3.5 w-3.5 text-brand-500" />
                    <span>{formatDate(row.preferredLastWorkingDate)}</span>
                  </div>
                ),
              },
              {
                header: "Status",
                cell: (row) => (
                  <StatusBadge
                    label={STATUS_LABELS[row.status] ?? row.status}
                    colorToken={STATUS_TOKEN[row.status] ?? "gray"}
                  />
                ),
              },
            ]}
            rows={filteredRows}
            getRowKey={(row) => String(row.id)}
          />
        </div>
      )}

      {/* 5. Create Request Dialog */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Submit Exit Request"
      >
        <NewExitRequestForm onClose={() => setCreateOpen(false)} />
      </Dialog>
    </div>
  );
}
