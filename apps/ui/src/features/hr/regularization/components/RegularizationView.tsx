"use client";

import { useState } from "react";
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
  Skeleton,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
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
 * permission. The API exposes one endpoint for every scope — there is no
 * separate approvals queue route, unlike Work Logs.
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

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Regularization
        </h1>
        {list.data ? (
          <p className="text-theme-sm text-gray-500 dark:text-gray-400">
            {hasFilters
              ? `Showing ${list.data.meta.total} matching requests`
              : `${list.data.meta.total} correction requests`}
          </p>
        ) : null}
      </div>
      {canCreate ? (
        <Button onClick={() => setSubmitOpen(true)}>
          Request a correction
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {header}

      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
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
          <Input
            type="number"
            min="1"
            aria-label="Filter by employee ID"
            placeholder="Employee ID"
            value={filters.employeeId}
            onChange={(e) => update("employeeId", e.target.value)}
          />
        </div>
        {hasFilters ? (
          <div className="mt-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters(EMPTY_FILTERS);
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : null}
      </Card>

      {list.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
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
                ? "Try a different status or employee, or clear the filters."
                : canCreate
                  ? "Request a correction to see it here."
                  : "Correction requests you are allowed to see will appear here."
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
              { header: "Employee", cell: (c) => c.employee.fullName },
              { header: "Date", cell: (c) => c.attendanceDate },
              {
                header: "Type",
                cell: (c) => CORRECTION_TYPE_LABELS[c.correctionType],
              },
              { header: "Reason", cell: (c) => c.reason },
              {
                header: "Status",
                cell: (c) => <CorrectionStatusBadge status={c.status} />,
              },
              {
                header: "Decided by",
                cell: (c) => c.decidedBy?.fullName ?? "—",
              },
              ...(canApprove
                ? [
                    {
                      header: "Actions",
                      cell: (c: AttendanceCorrectionItem) =>
                        c.status === "SUBMITTED" ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                setDecision({
                                  correction: c,
                                  decision: "approve",
                                })
                              }
                            >
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
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          "—"
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

      {submitOpen ? (
        <SubmitCorrectionDialog open onClose={() => setSubmitOpen(false)} />
      ) : null}

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
