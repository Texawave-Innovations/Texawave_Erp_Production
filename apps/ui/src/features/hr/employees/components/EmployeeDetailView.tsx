"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Edit,
  ExternalLink,
  History,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
  ShieldCheck,
  User,
  UserCheck,
  UserMinus,
  UserPlus,
} from "lucide-react";
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
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { useEmployee, useEmployeeStatusHistory } from "../hooks";
import {
  CORRECTIONS,
  STATUS_LABELS,
  TRANSITIONS,
  isExitStatus,
} from "../status";
import {
  ACCOUNT_WRITE,
  READ_ANY_SCOPE,
  STATUS_CORRECT,
  STATUS_WRITE,
  WRITE_TEAM_OR_ALL,
} from "../permissions";
import type { EmployeeDetail } from "../types";
import { ChangeStatusDialog } from "./ChangeStatusDialog";
import { EmployeeStatusBadge } from "./EmployeeStatusBadge";
import { LinkAccountDialog } from "./LinkAccountDialog";

const HISTORY_PAGE_SIZE = 10;

const dash = (v: string | null | undefined) => (v && v.length > 0 ? v : "—");
const dateOnly = (v: string | null) => (v ? v.slice(0, 10) : "—");

function DetailField({
  label,
  children,
  icon: Icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-neutral-100 bg-neutral-50/50 p-3 transition-colors hover:border-neutral-200 dark:border-neutral-800 dark:bg-neutral-900/30 dark:hover:border-neutral-700">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {Icon ? (
          <Icon className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
        ) : null}
        {label}
      </dt>
      <dd className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
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
  const canAccount = usePermission(ACCOUNT_WRITE);

  const query = useEmployee(id);
  const [historyPage, setHistoryPage] = useState(1);
  const history = useEmployeeStatusHistory(id, historyPage, HISTORY_PAGE_SIZE);
  const [statusDialog, setStatusDialog] = useState<null | "change" | "correct">(
    null,
  );
  const [accountDialog, setAccountDialog] = useState<null | "link" | "unlink">(
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
      <div className="flex flex-col gap-4 animate-pulse">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-44 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isNotFound) {
      return (
        <Card className="p-8">
          <EmptyState
            title="Employee not found"
            description="This employee does not exist, or you don't have access to them."
            action={
              <Link
                href="/hr/employees"
                className="inline-flex items-center gap-1.5 font-medium text-brand-600 hover:text-brand-700 hover:underline dark:text-brand-400"
              >
                <ArrowLeft className="h-4 w-4" />
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
    <div className="flex flex-col gap-6">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/hr/employees"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 transition-colors hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to employees
        </Link>
      </div>

      {/* Main Employee Identity Hero Card */}
      <Card className="overflow-hidden border-neutral-200/80 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <EmployeeIdentity
              name={e.fullName}
              code={e.employeeCode}
              size="lg"
            />
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-2xl">
                  {e.fullName}
                </h1>
                <EmployeeStatusBadge status={e.status} />
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 sm:text-sm">
                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                  {e.designation.name}
                </span>{" "}
                · {e.team.name}
                {e.department?.name ? ` (${e.department.name})` : ""}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-neutral-500 dark:text-neutral-400">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Joined {dateOnly(e.dateOfJoining)}
                </span>
                {e.workLocation?.name ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {e.workLocation.name}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  {e.hasLogin ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Login Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      No Login Account
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4 dark:border-neutral-800 lg:border-t-0 lg:pt-0">
            {canReadProfile ? (
              <Link
                href={`/hr/employees/${e.id}/profile`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-xs transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              >
                <User className="h-3.5 w-3.5" />
                Profile
              </Link>
            ) : null}

            {canRead ? (
              <Link
                href={`/hr/employees/${e.id}/onboarding`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-xs transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Onboarding
              </Link>
            ) : null}

            {canWrite ? (
              <Link
                href={`/hr/employees/${e.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-xs transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              >
                <Edit className="h-3.5 w-3.5" />
                Edit
              </Link>
            ) : null}

            {canChangeStatus ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setStatusDialog("change")}
              >
                <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                Change status
              </Button>
            ) : null}

            {canCorrectStatus ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setStatusDialog("correct")}
              >
                Correct status
              </Button>
            ) : null}

            {canAccount && !e.hasLogin ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAccountDialog("link")}
              >
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                Link account
              </Button>
            ) : null}

            {canAccount && e.hasLogin ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAccountDialog("unlink")}
              >
                <UserMinus className="h-3.5 w-3.5 mr-1.5 text-red-500" />
                Unlink account
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Two-Column Information Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Employment Information Card */}
        <Card className="border-neutral-200/80 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-4 flex items-center gap-2 border-b border-neutral-100 pb-3 dark:border-neutral-800">
            <Building2 className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              Employment Details
            </h2>
          </div>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailField label="Date of joining" icon={Calendar}>
              {dateOnly(e.dateOfJoining)}
            </DetailField>
            <DetailField label="Employment type">
              {e.employmentType.name}
            </DetailField>
            <DetailField label="Designation">{e.designation.name}</DetailField>
            <DetailField label="Team">{e.team.name}</DetailField>
            <DetailField label="Department">
              {dash(e.department?.name)}
            </DetailField>
            <DetailField label="Work location" icon={MapPin}>
              {dash(e.workLocation?.name)}
            </DetailField>
            <DetailField label="Reporting manager" icon={User}>
              {e.reportsTo ? (
                <Link
                  href={`/hr/employees/${e.reportsTo.id}`}
                  className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  {e.reportsTo.fullName} ({e.reportsTo.employeeCode})
                </Link>
              ) : (
                "—"
              )}
            </DetailField>
            <DetailField label="Login account" icon={ShieldCheck}>
              {e.hasLogin ? "Linked" : "Not linked"}
            </DetailField>
            {exit ? (
              <>
                <DetailField label="Exit date" icon={Calendar}>
                  {dateOnly(e.dateOfExit)}
                </DetailField>
                <DetailField label="Exit reason">
                  {dash(e.exitReason)}
                </DetailField>
              </>
            ) : null}
          </dl>
        </Card>

        {/* Contact & Connectivity Card */}
        <Card className="border-neutral-200/80 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-4 flex items-center gap-2 border-b border-neutral-100 pb-3 dark:border-neutral-800">
            <Mail className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              Contact & Communication
            </h2>
          </div>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailField label="Work e-mail" icon={Mail}>
              {e.workEmail ? (
                <a
                  href={`mailto:${e.workEmail}`}
                  className="text-brand-600 hover:underline dark:text-brand-400"
                >
                  {e.workEmail}
                </a>
              ) : (
                "—"
              )}
            </DetailField>
            <DetailField label="Phone" icon={Phone}>
              {e.phone ? (
                <a
                  href={`tel:${e.phone}`}
                  className="text-brand-600 hover:underline dark:text-brand-400"
                >
                  {e.phone}
                </a>
              ) : (
                "—"
              )}
            </DetailField>
          </dl>

          <div className="mt-6 rounded-lg border border-neutral-200/70 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
              Quick Actions
            </h3>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Need deeper personal, family, statutory, or onboarding details?
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {canReadProfile ? (
                <Link
                  href={`/hr/employees/${e.id}/profile`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-xs transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                >
                  View Employee Profile
                </Link>
              ) : null}
              {canRead ? (
                <Link
                  href={`/hr/employees/${e.id}/onboarding`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-xs transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                >
                  View Onboarding Checklist
                </Link>
              ) : null}
            </div>
          </div>
        </Card>
      </div>

      {/* Status History Card */}
      <Card className="border-neutral-200/80 bg-white p-6 shadow-xs dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-4 flex items-center justify-between border-b border-neutral-100 pb-3 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            <h2 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              Status Change History
            </h2>
          </div>
        </div>

        {history.isPending ? (
          <Skeleton className="h-28 w-full rounded-lg" />
        ) : history.isError ? (
          <ErrorState onRetry={() => void history.refetch()} />
        ) : history.data.data.length === 0 ? (
          <EmptyState
            title="No status changes yet"
            description="Changes to this employee's status will be logged here."
          />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
              <DataTable
                caption="Status history"
                rows={history.data.data}
                getRowKey={(row) => String(row.id)}
                columns={[
                  {
                    header: "Effective",
                    cell: (row) => (
                      <span className="font-mono text-xs text-neutral-600 dark:text-neutral-400">
                        {dateOnly(row.effectiveDate)}
                      </span>
                    ),
                  },
                  {
                    header: "Change",
                    cell: (row) => (
                      <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                        {row.fromStatus
                          ? `${STATUS_LABELS[row.fromStatus]} → ${STATUS_LABELS[row.toStatus]}`
                          : `Set to ${STATUS_LABELS[row.toStatus]}`}
                      </span>
                    ),
                  },
                  {
                    header: "Type",
                    cell: (row) => (
                      <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                        {row.changeType === "correction"
                          ? "Correction"
                          : "Change"}
                      </span>
                    ),
                  },
                  {
                    header: "Reason",
                    cell: (row) => (
                      <span className="text-xs text-neutral-600 dark:text-neutral-400">
                        {dash(row.reason)}
                      </span>
                    ),
                  },
                  {
                    header: "Changed By",
                    cell: (row) => (
                      <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                        {dash(row.changer?.fullName)}
                      </span>
                    ),
                  },
                ]}
              />
            </div>
            <Pagination
              page={history.data.meta.page}
              totalPages={history.data.meta.totalPages}
              onPageChange={setHistoryPage}
            />
          </div>
        )}
      </Card>

      {/* Dialog Triggers */}
      {statusDialog ? (
        <ChangeStatusDialog
          open
          onClose={() => setStatusDialog(null)}
          employee={e}
          correction={statusDialog === "correct"}
        />
      ) : null}

      {accountDialog ? (
        <LinkAccountDialog
          open
          onClose={() => setAccountDialog(null)}
          employee={e}
          mode={accountDialog}
        />
      ) : null}
    </div>
  );
}
