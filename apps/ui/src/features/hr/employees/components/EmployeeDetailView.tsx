"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Calendar,
  Edit,
  ExternalLink,
  FileDown,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
  ShieldCheck,
  User,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Pagination,
  Semantic3DIcon,
  Skeleton,
  useToast,
} from "@texawave-erp/ui-kit";
import { downloadProfilePdf } from "../api";
import { LinkAccountDialog } from "./LinkAccountDialog";
import { OnboardingReviewPanel } from "./OnboardingReviewPanel";
import { usePermission } from "@/hooks/usePermission";
import { useRegionalFormatter } from "@/features/settings/preferences/hooks";
import { PROFILE_READ_ANY_SCOPE } from "@/features/hr/profiles/permissions";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import {
  useEmployee,
  useEmployeeStatusHistory,
  useUnlinkEmployeeUser,
} from "../hooks";
import { STATUS_LABELS, isExitStatus } from "../status";
import {
  ACCOUNT_WRITE,
  READ_ANY_SCOPE,
  WRITE_TEAM_OR_ALL,
} from "../permissions";
import type { EmployeeDetail } from "../types";
import { EmployeeStatusBadge } from "./EmployeeStatusBadge";

const HISTORY_PAGE_SIZE = 10;

const dash = (v: string | null | undefined) => (v && v.length > 0 ? v : "—");

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
    <div className="flex flex-col gap-1 rounded-xl border border-sky-100 bg-white/90 p-3.5 shadow-2xs transition-all hover:border-sky-200 hover:shadow-xs dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700">
      <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
        {Icon ? (
          <Icon className="h-3.5 w-3.5 text-brand-500 dark:text-sky-400" />
        ) : null}
        {label}
      </dt>
      <dd className="text-theme-sm font-semibold text-[#0a3271] dark:text-white">
        {children}
      </dd>
    </div>
  );
}

/** Read-only employee record with the status actions the caller is allowed to use. */
export function EmployeeDetailView({ id }: { id: number }) {
  const canRead = usePermission(READ_ANY_SCOPE);
  const canWrite = usePermission(WRITE_TEAM_OR_ALL);
  const canReadProfile = usePermission(PROFILE_READ_ANY_SCOPE);
  const canAccount = usePermission(ACCOUNT_WRITE);

  const query = useEmployee(id);
  const [historyPage, setHistoryPage] = useState(1);
  const history = useEmployeeStatusHistory(id, historyPage, HISTORY_PAGE_SIZE);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const unlinkMutation = useUnlinkEmployeeUser();
  const { toast } = useToast();
  const { formatDate } = useRegionalFormatter();
  const dateOnly = (v: string | null) => (v ? formatDate(v) : "—");

  if (!canRead) {
    return (
      <Alert variant="warning" title="You don't have access to this employee">
        Ask an administrator for the <code>hr.employee.read</code> permission.
      </Alert>
    );
  }

  if (query.isPending) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6 pb-6 animate-pulse">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isNotFound) {
      return (
        <div className="rounded-2xl border border-sky-200/90 bg-white p-8 shadow-xs dark:border-slate-800 dark:bg-gray-900">
          <EmptyState
            title="Employee not found"
            description="This employee does not exist, or you don't have access to them."
            action={
              <Link
                href="/hr/employees"
                className="font-bold text-brand-500 hover:underline"
              >
                Back to employees
              </Link>
            }
          />
        </div>
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const e: EmployeeDetail = query.data;
  const exit = isExitStatus(e.status);

  async function handleAccountAction() {
    if (!canAccount && !canWrite) {
      toast({
        title: "Permission denied",
        description: "You do not have permission to manage employee accounts.",
        variant: "error",
      });
      return;
    }
    if (e.hasLogin) {
      try {
        await unlinkMutation.mutateAsync({
          id: e.id,
          body: { reason: "Unlinked via employee detail quick action" },
        });
        toast({
          title: "Account unlinked",
          description: `${e.fullName}'s login has been detached.`,
          variant: "success",
        });
      } catch (error) {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to unlink employee account";
        toast({
          title: "Unlink failed",
          description: message,
          variant: "error",
        });
      }
    } else {
      setLinkDialogOpen(true);
    }
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    try {
      await downloadProfilePdf(id, e.fullName);
      toast({
        title: "Profile PDF downloaded",
        description: `Saved report for ${e.fullName}.`,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Could not create the PDF",
        description:
          error instanceof Error ? error.message : "Try again in a moment.",
        variant: "error",
      });
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-8 animate-reveal">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/hr/employees"
          className="group inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-500 hover:text-[#0a3271] dark:text-sky-400 dark:hover:text-sky-200 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to employees</span>
        </Link>
      </div>

      {/* Main Employee Identity Hero Banner Card */}
      <div className="relative overflow-visible rounded-2xl border border-sky-200/90 bg-linear-to-r from-[#edf6ff] via-[#f0f8ff] to-[#e6f4fe] p-6 shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] dark:border-slate-700/80 dark:from-slate-800/90 dark:via-slate-850 dark:to-slate-900/60">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <EmployeeIdentity
              name={e.fullName}
              code={e.employeeCode}
              size="lg"
            />
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-[#0a3271] dark:text-sky-100 sm:text-2xl">
                  {e.fullName}
                </h1>
                <EmployeeStatusBadge status={e.status} />
              </div>
              <p className="text-xs text-[#2f6396] dark:text-sky-200/90 sm:text-sm">
                <span className="font-semibold text-[#0a3271] dark:text-sky-100">
                  {e.designation.name}
                </span>{" "}
                · {e.team.name}
                {e.department?.name ? ` (${e.department.name})` : ""}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs font-semibold text-[#2f6396] dark:text-sky-300/80">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-sky-200/80 bg-white/80 px-2 py-0.5 text-[11px] shadow-2xs dark:border-slate-700 dark:bg-slate-800">
                  <Calendar className="h-3.5 w-3.5 text-brand-500" />
                  Joined {dateOnly(e.dateOfJoining)}
                </span>
                {e.workLocation?.name ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-sky-200/80 bg-white/80 px-2 py-0.5 text-[11px] shadow-2xs dark:border-slate-700 dark:bg-slate-800">
                    <MapPin className="h-3.5 w-3.5 text-brand-500" />
                    {e.workLocation.name}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1.5 rounded-md border border-sky-200/80 bg-white/80 px-2 py-0.5 text-[11px] shadow-2xs dark:border-slate-700 dark:bg-slate-800">
                  {e.hasLogin ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-brand-500 dark:text-cyan-400">
                      <ShieldCheck className="h-3.5 w-3.5 text-brand-500 dark:text-cyan-400" />
                      Login Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      No Login Account
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Action Toolbar - Cleaned with change status & unlink buttons removed */}
          <div className="flex flex-wrap items-center gap-2 border-t border-sky-200/80 pt-4 dark:border-slate-700/80 lg:border-t-0 lg:pt-0">
            {canReadProfile ? (
              <Link
                href={`/hr/employees/${e.id}/profile`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200/90 bg-white px-3.5 py-2 text-xs font-bold text-[#0a3271] shadow-2xs transition-all hover:bg-sky-50/60 hover:shadow-xs dark:border-slate-700/80 dark:bg-slate-800/90 dark:text-white"
              >
                <User className="h-3.5 w-3.5 text-brand-500 dark:text-cyan-400" />
                Profile
              </Link>
            ) : null}

            {canRead ? (
              <Link
                href={`/hr/employees/${e.id}/onboarding`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200/90 bg-white px-3.5 py-2 text-xs font-bold text-[#0a3271] shadow-2xs transition-all hover:bg-sky-50/60 hover:shadow-xs dark:border-slate-700/80 dark:bg-slate-800/90 dark:text-white"
              >
                <ExternalLink className="h-3.5 w-3.5 text-brand-500 dark:text-cyan-400" />
                Onboarding
              </Link>
            ) : null}

            {canReadProfile ? (
              <Button
                variant="secondary"
                size="sm"
                loading={downloadingPdf}
                onClick={() => void handleDownloadPdf()}
                className="rounded-xl border border-sky-200/90 bg-white px-3.5 py-2 text-xs font-bold text-[#0a3271] shadow-2xs transition-all hover:bg-sky-50/60 hover:shadow-xs dark:border-slate-700/80 dark:bg-slate-800/90 dark:text-white"
              >
                <FileDown className="h-3.5 w-3.5 mr-1.5 text-brand-500 dark:text-cyan-400" />
                Download PDF
              </Button>
            ) : null}

            {canWrite ? (
              <Link
                href={`/hr/employees/${e.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200/90 bg-white px-3.5 py-2 text-xs font-bold text-[#0a3271] shadow-2xs transition-all hover:bg-sky-50/60 hover:shadow-xs dark:border-slate-700/80 dark:bg-slate-800/90 dark:text-white"
              >
                <Edit className="h-3.5 w-3.5 text-brand-500 dark:text-cyan-400" />
                Edit
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <OnboardingReviewPanel employee={e} />

      {/* Two-Column Information Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Employment Information Card */}
        <div className="overflow-visible rounded-2xl border border-sky-200/90 bg-white shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] dark:border-slate-700/80 dark:bg-gray-900 transition-all duration-200 hover:shadow-[0_8px_30px_-6px_rgba(23,105,245,0.12)]">
          {/* Prime Blue Header with Light Contrast */}
          <div className="flex items-center justify-between border-b border-sky-200/90 bg-linear-to-r from-[#edf6ff] via-[#f0f8ff] to-[#e6f4fe] px-6 py-4.5 rounded-t-2xl dark:border-slate-700/80 dark:from-slate-800/90 dark:via-slate-850 dark:to-slate-900/60">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-200/90 bg-white/95 p-1.5 shadow-[0_2px_10px_rgba(23,105,245,0.1)] dark:border-gray-700/80 dark:bg-gray-800 select-none">
                <Semantic3DIcon name="departments" size={28} />
              </div>
              <div>
                <h2 className="text-theme-sm font-bold tracking-tight text-[#0a3271] dark:text-sky-100">
                  Employment Details
                </h2>
                <p className="mt-0.5 text-[11px] font-medium text-[#2f6396] dark:text-sky-300/80">
                  Organizational placement, role, and reporting structure
                </p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="rounded-xl border border-sky-200/80 bg-linear-to-b from-[#f8fbff]/60 to-white p-5 shadow-2xs dark:border-slate-700/80 dark:bg-slate-800/40">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailField label="Date of joining" icon={Calendar}>
                  {dateOnly(e.dateOfJoining)}
                </DetailField>
                <DetailField label="Employment type">
                  {e.employmentType.name}
                </DetailField>
                <DetailField label="Designation">
                  {e.designation.name}
                </DetailField>
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
                      className="font-bold text-brand-500 hover:underline dark:text-cyan-400"
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
                <DetailField label="Probation ends" icon={Calendar}>
                  {dateOnly(e.probationEndDate)}
                </DetailField>
                <DetailField label="Confirmation date" icon={Calendar}>
                  {dateOnly(e.confirmationDate)}
                </DetailField>
                <DetailField label="Work domain">
                  {dash(e.workDomain)}
                </DetailField>
                <DetailField label="Referred by">
                  {dash(e.referredBy)}
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
            </div>
          </div>
        </div>

        {/* Contact & Communication Card */}
        <div className="overflow-visible rounded-2xl border border-sky-200/90 bg-white shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] dark:border-slate-700/80 dark:bg-gray-900 transition-all duration-200 hover:shadow-[0_8px_30px_-6px_rgba(23,105,245,0.12)]">
          {/* Prime Blue Header with Light Contrast */}
          <div className="flex items-center justify-between border-b border-sky-200/90 bg-linear-to-r from-[#edf6ff] via-[#f0f8ff] to-[#e6f4fe] px-6 py-4.5 rounded-t-2xl dark:border-slate-700/80 dark:from-slate-800/90 dark:via-slate-850 dark:to-slate-900/60">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-200/90 bg-white/95 p-1.5 shadow-[0_2px_10px_rgba(23,105,245,0.1)] dark:border-gray-700/80 dark:bg-gray-800 select-none">
                <Semantic3DIcon name="user" size={28} />
              </div>
              <div>
                <h2 className="text-theme-sm font-bold tracking-tight text-[#0a3271] dark:text-sky-100">
                  Contact & Communication
                </h2>
                <p className="mt-0.5 text-[11px] font-medium text-[#2f6396] dark:text-sky-300/80">
                  Direct contact channels and employee profile navigation
                </p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-5">
            <div className="rounded-xl border border-sky-200/80 bg-linear-to-b from-[#f8fbff]/60 to-white p-5 shadow-2xs dark:border-slate-700/80 dark:bg-slate-800/40">
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailField label="Work e-mail" icon={Mail}>
                  {e.workEmail ? (
                    <a
                      href={`mailto:${e.workEmail}`}
                      className="font-bold text-brand-500 hover:underline dark:text-cyan-400"
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
                      className="font-bold text-brand-500 hover:underline dark:text-cyan-400"
                    >
                      {e.phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </DetailField>
                <DetailField label="Login password" icon={KeyRound}>
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        e.hasLogin
                          ? "text-brand-500 dark:text-cyan-400"
                          : "text-slate-500 dark:text-slate-400"
                      }
                    >
                      {e.hasLogin ? "Created" : "Not created"}
                    </span>
                    {canAccount || canWrite ? (
                      <Button
                        type="button"
                        variant={e.hasLogin ? "secondary" : "primary"}
                        size="sm"
                        loading={unlinkMutation.isPending}
                        onClick={() => void handleAccountAction()}
                        className="h-7 px-2.5 text-[11px]"
                      >
                        {e.hasLogin ? "Unlink" : "Create / Link"}
                      </Button>
                    ) : null}
                  </div>
                </DetailField>
              </dl>
            </div>

            <div className="rounded-xl border border-sky-200/80 bg-[#edf6ff]/40 p-5 dark:border-slate-700 dark:bg-slate-800/40">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
                Quick Actions
              </h3>
              <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                Need deeper personal, family, statutory, or onboarding details?
              </p>
              <div className="mt-3.5 flex flex-wrap gap-2.5">
                {canReadProfile ? (
                  <Link
                    href={`/hr/employees/${e.id}/profile`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200/90 bg-white px-3.5 py-2 text-xs font-bold text-[#0a3271] shadow-2xs transition-all hover:bg-sky-50/60 hover:shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-sky-200 dark:hover:bg-slate-755"
                  >
                    <User className="h-3.5 w-3.5 text-brand-500 dark:text-cyan-400" />
                    View Employee Profile
                  </Link>
                ) : null}
                {canRead ? (
                  <Link
                    href={`/hr/employees/${e.id}/onboarding`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200/90 bg-white px-3.5 py-2 text-xs font-bold text-[#0a3271] shadow-2xs transition-all hover:bg-sky-50/60 hover:shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-sky-200 dark:hover:bg-slate-755"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-brand-500 dark:text-cyan-400" />
                    View Onboarding Checklist
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status History Card */}
      <div className="overflow-visible rounded-2xl border border-sky-200/90 bg-white shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] dark:border-slate-700/80 dark:bg-gray-900 transition-all duration-200 hover:shadow-[0_8px_30px_-6px_rgba(23,105,245,0.12)]">
        <div className="flex items-center justify-between border-b border-sky-200/90 bg-linear-to-r from-[#edf6ff] via-[#f0f8ff] to-[#e6f4fe] px-6 py-4.5 rounded-t-2xl dark:border-slate-700/80 dark:from-slate-800/90 dark:via-slate-850 dark:to-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-200/90 bg-white/95 p-1.5 shadow-[0_2px_10px_rgba(23,105,245,0.1)] dark:border-gray-700/80 dark:bg-gray-800 select-none">
              <Semantic3DIcon name="access-control" size={28} />
            </div>
            <div>
              <h2 className="text-theme-sm font-bold tracking-tight text-[#0a3271] dark:text-sky-100">
                Status Change History
              </h2>
              <p className="mt-0.5 text-[11px] font-medium text-[#2f6396] dark:text-sky-300/80">
                Audited timeline of employee status transitions and corrections
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {history.isPending ? (
            <Skeleton className="h-28 w-full rounded-xl" />
          ) : history.isError ? (
            <ErrorState onRetry={() => void history.refetch()} />
          ) : history.data.data.length === 0 ? (
            <EmptyState
              title="No status changes yet"
              description="Changes to this employee's status will be logged here."
            />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="overflow-x-auto rounded-xl border border-sky-200/90 shadow-2xs dark:border-slate-700">
                <DataTable
                  caption="Status history"
                  rows={history.data.data}
                  getRowKey={(row) => String(row.id)}
                  columns={[
                    {
                      header: "Effective",
                      cell: (row) => (
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {dateOnly(row.effectiveDate)}
                        </span>
                      ),
                    },
                    {
                      header: "Change",
                      cell: (row) => (
                        <span className="text-xs font-bold text-[#0a3271] dark:text-sky-100">
                          {row.fromStatus
                            ? `${STATUS_LABELS[row.fromStatus]} → ${STATUS_LABELS[row.toStatus]}`
                            : `Set to ${STATUS_LABELS[row.toStatus]}`}
                        </span>
                      ),
                    },
                    {
                      header: "Type",
                      cell: (row) => (
                        <span className="inline-flex items-center rounded-full border border-sky-200/90 bg-white/90 px-2.5 py-0.5 text-[10px] font-bold text-brand-500 shadow-2xs dark:border-sky-800 dark:bg-slate-800 dark:text-sky-300">
                          {row.changeType === "correction"
                            ? "Correction"
                            : "Change"}
                        </span>
                      ),
                    },
                    {
                      header: "Reason",
                      cell: (row) => (
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          {dash(row.reason)}
                        </span>
                      ),
                    },
                    {
                      header: "Changed By",
                      cell: (row) => (
                        <span className="text-xs font-semibold text-[#0a3271] dark:text-slate-200">
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
        </div>
      </div>

      {linkDialogOpen ? (
        <LinkAccountDialog
          open={linkDialogOpen}
          onClose={() => setLinkDialogOpen(false)}
          employee={e}
          mode="link"
        />
      ) : null}
    </div>
  );
}
