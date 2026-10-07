"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { PROFILE_READ_ANY_SCOPE } from "@/features/hr/profiles/permissions";
import { useEmployee, useEmployeeStatusHistory } from "../hooks";
import {
  CORRECTIONS,
  STATUS_LABELS,
  TRANSITIONS,
  isExitStatus,
} from "../status";
import {
  READ_ANY_SCOPE,
  STATUS_CORRECT,
  STATUS_WRITE,
  WRITE_TEAM_OR_ALL,
} from "../permissions";
import type { EmployeeDetail } from "../types";
import { ChangeStatusDialog } from "./ChangeStatusDialog";
import { EmployeeStatusBadge } from "./EmployeeStatusBadge";

const HISTORY_PAGE_SIZE = 10;

const dash = (v: string | null | undefined) => (v && v.length > 0 ? v : "—");
const dateOnly = (v: string | null) => (v ? v.slice(0, 10) : "—");

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-theme-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="text-theme-sm text-gray-900 dark:text-white/90">
        {children}
      </dd>
    </div>
  );
}

/** Read-only employee record with the status actions the caller is allowed to use. */
export function EmployeeDetailView({ id }: { id: number }) {
  const canRead = usePermission(READ_ANY_SCOPE);
  const canWrite = usePermission(WRITE_TEAM_OR_ALL);
  const canStatus = usePermission(STATUS_WRITE);
  const canCorrect = usePermission(STATUS_CORRECT);
  const canReadProfile = usePermission(PROFILE_READ_ANY_SCOPE);

  const query = useEmployee(id);
  const [historyPage, setHistoryPage] = useState(1);
  const history = useEmployeeStatusHistory(id, historyPage, HISTORY_PAGE_SIZE);
  const [statusDialog, setStatusDialog] = useState<null | "change" | "correct">(
    null,
  );

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to this employee">
        Ask an administrator for the <code>hr.employee.read</code> permission.
      </Alert>
    );
  }

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isNotFound) {
      return (
        <Card>
          <EmptyState
            title="Employee not found"
            description="This employee does not exist, or you don't have access to them."
            action={
              <Link
                href="/hr/employees"
                className="text-brand-600 hover:underline"
              >
                Back to employees
              </Link>
            }
          />
        </Card>
      );
    }
    if (error instanceof ApiError && error.isPermissionError) {
      return (
        <Alert variant="warning" title="You don't have access to this employee">
          Your access has changed. Contact an administrator.
        </Alert>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const e: EmployeeDetail = query.data;
  const exit = isExitStatus(e.status);
  const canChangeStatus = canStatus && TRANSITIONS[e.status].length > 0;
  const canCorrectStatus = canCorrect && CORRECTIONS[e.status].length > 0;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/hr/employees"
        className="text-theme-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        ← Back to employees
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
                {e.fullName}
              </h1>
              <EmployeeStatusBadge status={e.status} />
            </div>
            <p className="text-theme-sm text-gray-500 dark:text-gray-400">
              {e.employeeCode} · {e.designation.name} · {e.team.name}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canReadProfile ? (
              <Link
                href={`/hr/employees/${e.id}/profile`}
                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-theme-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                Profile
              </Link>
            ) : null}
            {canWrite ? (
              <Link
                href={`/hr/employees/${e.id}/edit`}
                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-theme-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                Edit
              </Link>
            ) : null}
            {canChangeStatus ? (
              <Button
                variant="secondary"
                onClick={() => setStatusDialog("change")}
              >
                Change status
              </Button>
            ) : null}
            {canCorrectStatus ? (
              <Button
                variant="secondary"
                onClick={() => setStatusDialog("correct")}
              >
                Correct status
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
            Employment
          </h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Date of joining">{dateOnly(e.dateOfJoining)}</Field>
            <Field label="Employment type">{e.employmentType.name}</Field>
            <Field label="Designation">{e.designation.name}</Field>
            <Field label="Team">{e.team.name}</Field>
            <Field label="Department">{dash(e.department?.name)}</Field>
            <Field label="Work location">{dash(e.workLocation?.name)}</Field>
            <Field label="Reporting manager">
              {e.reportsTo ? (
                <Link
                  href={`/hr/employees/${e.reportsTo.id}`}
                  className="text-brand-600 hover:underline"
                >
                  {e.reportsTo.fullName} ({e.reportsTo.employeeCode})
                </Link>
              ) : (
                "—"
              )}
            </Field>
            <Field label="Login account">
              {e.hasLogin ? "Linked" : "Not linked"}
            </Field>
            {exit ? (
              <>
                <Field label="Exit date">{dateOnly(e.dateOfExit)}</Field>
                <Field label="Exit reason">{dash(e.exitReason)}</Field>
              </>
            ) : null}
          </dl>
        </Card>

        <Card>
          <h2 className="mb-4 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
            Contact
          </h2>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Work e-mail">{dash(e.workEmail)}</Field>
            <Field label="Phone">{dash(e.phone)}</Field>
          </dl>
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 text-theme-sm font-semibold text-gray-900 dark:text-white/90">
          Status history
        </h2>
        {history.isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : history.isError ? (
          <ErrorState onRetry={() => void history.refetch()} />
        ) : history.data.data.length === 0 ? (
          <EmptyState
            title="No status changes yet"
            description="Changes to this employee's status will be listed here."
          />
        ) : (
          <div className="flex flex-col gap-3">
            <DataTable
              caption="Status history"
              rows={history.data.data}
              getRowKey={(row) => String(row.id)}
              columns={[
                {
                  header: "Effective",
                  cell: (row) => dateOnly(row.effectiveDate),
                },
                {
                  header: "Change",
                  cell: (row) =>
                    row.fromStatus
                      ? `${STATUS_LABELS[row.fromStatus]} → ${STATUS_LABELS[row.toStatus]}`
                      : `Set to ${STATUS_LABELS[row.toStatus]}`,
                },
                {
                  header: "Type",
                  cell: (row) =>
                    row.changeType === "correction" ? "Correction" : "Change",
                },
                { header: "Reason", cell: (row) => dash(row.reason) },
                { header: "By", cell: (row) => dash(row.changer?.fullName) },
              ]}
            />
            <Pagination
              page={history.data.meta.page}
              totalPages={history.data.meta.totalPages}
              onPageChange={setHistoryPage}
            />
          </div>
        )}
      </Card>

      {statusDialog ? (
        <ChangeStatusDialog
          open
          onClose={() => setStatusDialog(null)}
          employee={e}
          correction={statusDialog === "correct"}
        />
      ) : null}
    </div>
  );
}
