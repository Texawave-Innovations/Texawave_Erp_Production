"use client";

import { useMemo, useState } from "react";
import { Check, Clock, Plus, Search, X } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  Pagination,
  Select,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import {
  FilterChips,
  type FilterChipItem,
} from "@/features/hr/components/FilterChip";
import { TableSkeleton } from "@/features/hr/components/TableSkeleton";
import { formatTime } from "@/features/hr/attendance/status";
import { useCorrections } from "../hooks";
import {
  APPROVE_ANY_SCOPE,
  READ_ANY_SCOPE,
  SELF_SERVICE_CREATE,
} from "../permissions";
import { CORRECTION_TYPE_LABELS, STATUS_LABELS } from "../status";
import {
  CORRECTION_STATUSES,
  type AttendanceCorrectionItem,
  type CorrectionStatus,
} from "../types";
import { CorrectionStatusBadge } from "./CorrectionStatusBadge";
import { DecideCorrectionDialog } from "./DecideCorrectionDialog";
import { SubmitCorrectionDialog } from "./SubmitCorrectionDialog";

const PAGE_SIZE = 20;

interface Filters {
  status: "" | CorrectionStatus;
  employeeId: string;
}

const EMPTY_FILTERS: Filters = { status: "", employeeId: "" };

type Decision = {
  correction: AttendanceCorrectionItem;
  decision: "approve" | "reject";
} | null;

/**
 * Attendance corrections ("Regularization"): a single list, scoped
 * server-side to the caller's own/team/all permission, with a "Request a
 * correction" action for self-service and approve/reject for the approval
 * permission.
 */
export function RegularizationView() {
  const canRead = usePermission(READ_ANY_SCOPE);
  const canApprove = usePermission(APPROVE_ANY_SCOPE);
  const canCreate = usePermission(SELF_SERVICE_CREATE);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [decision, setDecision] = useState<Decision>(null);

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };

  const employeeIdNum = Number(filters.employeeId);
  const hasValidEmployeeId =
    filters.employeeId !== "" &&
    Number.isInteger(employeeIdNum) &&
    employeeIdNum > 0;

  const query = {
    page,
    limit: PAGE_SIZE,
    ...(filters.status ? { status: filters.status } : {}),
    ...(hasValidEmployeeId ? { employeeId: employeeIdNum } : {}),
  };

  const list = useCorrections(query);
  const hasFilters = filters.status !== "" || filters.employeeId !== "";

  // Active filter chips
  const activeChips = useMemo<FilterChipItem[]>(() => {
    const chips: FilterChipItem[] = [];
    if (filters.status) {
      chips.push({
        id: "status",
        label: "Status",
        value: STATUS_LABELS[filters.status],
        onRemove: () => update("status", ""),
      });
    }
    if (filters.employeeId) {
      chips.push({
        id: "employeeId",
        label: "Employee ID",
        value: `#${filters.employeeId}`,
        onRemove: () => update("employeeId", ""),
      });
    }
    return chips;
  }, [filters]);

  if (!canRead) {
    return (
      <Alert
        variant="warning"
        title="You don't have access to attendance corrections"
      >
        Ask an administrator for the <code>hr.attendance_correction.read</code>{" "}
        permission.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-theme-xl font-bold tracking-tight text-gray-900 dark:text-white">
              Regularization
            </h1>
            {list.data ? (
              <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-theme-xs font-semibold text-brand-700 dark:bg-brand-950/70 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
                {list.data.meta.total} requests
              </span>
            ) : null}
          </div>
          <p className="text-theme-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Review and manage employee attendance correction requests.
          </p>
        </div>

        {canCreate ? (
          <Button
            onClick={() => setSubmitOpen(true)}
            className="inline-flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="h-4 w-4" />
            Request a correction
          </Button>
        ) : null}
      </div>

      {/* Filters Card */}
      <Card>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 items-center">
            <Select
              aria-label="Filter by status"
              value={filters.status}
              onChange={(e) =>
                update("status", e.target.value as "" | CorrectionStatus)
              }
            >
              <option value="">All statuses</option>
              {CORRECTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>

            <div className="relative">
              <Input
                type="number"
                min="1"
                aria-label="Filter by employee ID"
                placeholder="Search by Employee ID..."
                value={filters.employeeId}
                onChange={(e) => update("employeeId", e.target.value)}
                className="pl-9"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

            {hasFilters ? (
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilters(EMPTY_FILTERS);
                    setPage(1);
                  }}
                  className="text-theme-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 inline-flex items-center gap-1.5"
                >
                  <X className="h-3.5 w-3.5" />
                  Reset filters
                </Button>
              </div>
            ) : null}
          </div>

          {activeChips.length > 0 ? (
            <FilterChips
              chips={activeChips}
              onClearAll={() => {
                setFilters(EMPTY_FILTERS);
                setPage(1);
              }}
              className="pt-2 border-t border-gray-100 dark:border-gray-800"
            />
          ) : null}
        </div>
      </Card>

      {/* Requests Table States */}
      {list.isPending ? (
        <TableSkeleton rowsCount={6} columnsCount={7} />
      ) : list.isError ? (
        list.error instanceof ApiError && list.error.isPermissionError ? (
          <Alert
            variant="warning"
            title="You don't have access to attendance corrections"
          >
            Your access to this list has changed. Contact an administrator.
          </Alert>
        ) : (
          <ErrorState onRetry={() => void list.refetch()} />
        )
      ) : list.data.data.length === 0 ? (
        <Card>
          <EmptyState
            title={
              hasFilters
                ? "No requests match these filters"
                : "No correction requests yet"
            }
            description={
              hasFilters
                ? "Try a different status or employee ID, or reset the filters."
                : canCreate
                  ? "Click 'Request a correction' above to submit your first request."
                  : "Correction requests you are allowed to see will appear here."
            }
            action={
              hasFilters ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setFilters(EMPTY_FILTERS);
                    setPage(1);
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <DataTable
            caption="Attendance corrections"
            rows={list.data.data}
            getRowKey={(c) => String(c.id)}
            columns={[
              {
                header: "Employee",
                cell: (c) => (
                  <EmployeeIdentity
                    name={c.employee.fullName}
                    code={c.employee.employeeCode}
                    avatarSize="sm"
                    size="sm"
                  />
                ),
              },
              {
                header: "Date",
                cell: (c) => (
                  <span className="font-medium text-gray-800 dark:text-gray-200 text-theme-xs">
                    {c.attendanceDate}
                  </span>
                ),
              },
              {
                header: "Type",
                cell: (c) => {
                  const hasIn = Boolean(c.requestedCheckInAt);
                  const hasOut = Boolean(c.requestedCheckOutAt);
                  return (
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-gray-900 dark:text-white text-theme-xs">
                        {CORRECTION_TYPE_LABELS[c.correctionType]}
                      </span>
                      {hasIn || hasOut ? (
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-gray-500 dark:text-gray-400">
                          <Clock className="h-3 w-3 text-gray-400 shrink-0" />
                          <span>
                            {hasIn
                              ? `In: ${formatTime(c.requestedCheckInAt!)}`
                              : ""}
                            {hasIn && hasOut ? " • " : ""}
                            {hasOut
                              ? `Out: ${formatTime(c.requestedCheckOutAt!)}`
                              : ""}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  );
                },
              },
              {
                header: "Reason",
                cell: (c) => (
                  <span
                    title={c.reason}
                    className="block max-w-xs truncate text-theme-xs text-gray-600 dark:text-gray-300"
                  >
                    {c.reason}
                  </span>
                ),
              },
              {
                header: "Status",
                cell: (c) => <CorrectionStatusBadge status={c.status} />,
              },
              {
                header: "Decided by",
                cell: (c) => (
                  <div className="flex flex-col">
                    <span className="text-theme-xs text-gray-800 dark:text-gray-200 font-medium">
                      {c.decidedBy?.fullName ?? "—"}
                    </span>
                    {c.decisionNote ? (
                      <span
                        title={c.decisionNote}
                        className="text-[11px] text-gray-400 truncate max-w-36 italic"
                      >
                        &ldquo;{c.decisionNote}&rdquo;
                      </span>
                    ) : null}
                  </div>
                ),
              },
              {
                header: "Note",
                cell: (c) => c.decisionNote ?? "—",
              },
              ...(canApprove
                ? [
                    {
                      header: "Actions",
                      cell: (c: AttendanceCorrectionItem) =>
                        c.status === "SUBMITTED" ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              onClick={() =>
                                setDecision({
                                  correction: c,
                                  decision: "approve",
                                })
                              }
                              className="h-8 px-2.5 text-theme-xs inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                setDecision({
                                  correction: c,
                                  decision: "reject",
                                })
                              }
                              className="h-8 px-2.5 text-theme-xs inline-flex items-center gap-1"
                            >
                              <X className="h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
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

      {/* Submit Correction Dialog */}
      {submitOpen ? (
        <SubmitCorrectionDialog open onClose={() => setSubmitOpen(false)} />
      ) : null}

      {/* Decide Correction Dialog */}
      {decision ? (
        <DecideCorrectionDialog
          open
          onClose={() => setDecision(null)}
          correction={decision.correction}
          decision={decision.decision}
        />
      ) : null}
    </div>
  );
}
