"use client";

import { useState } from "react";
import {
  Ban,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  PlayCircle,
  RotateCcw,
  Users,
} from "lucide-react";
import { Button, EmptyState } from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/stores/auth-store";
import { isoDate, periodLabel, timestamp } from "../format";
import { useRuns } from "../hooks";
import {
  PAYROLL_APPROVE,
  PAYROLL_FINALIZE,
  PAYROLL_REOPEN,
  PAYROLL_WRITE,
} from "../permissions";
import type { PayrollPeriod, PayrollRun } from "../types";
import { EntriesDialog } from "./EntriesDialog";
import { lifecycleStep, PayrollLifecycle } from "./PayrollLifecycle";
import {
  ApproveRunDialog,
  ConfirmPeriodDialog,
  RunPayrollDialog,
} from "./PeriodDialogs";
import {
  PeriodReportsSection,
  ReopenedNotice,
  ReopenPeriodDialog,
} from "./PeriodExtras";
import { PayrollStatusBadge } from "./PayrollStatusBadge";
import { QueryState } from "./QueryState";

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const PIPELINE_STEPS = ["Created", "Run", "Approved", "Finalized"] as const;

export interface PeriodCardProps {
  period: PayrollPeriod;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

export function PeriodCard({
  period,
  isExpanded,
  onToggleExpand,
}: PeriodCardProps) {
  const canWrite = usePermission(PAYROLL_WRITE);
  const canApprove = usePermission(PAYROLL_APPROVE);
  const canFinalize = usePermission(PAYROLL_FINALIZE);
  const canReopen = usePermission(PAYROLL_REOPEN);

  const userId = useAuthStore((s) => s.user?.userId ?? null);

  // Fetch runs for this period only when expanded or to resolve runs details
  const runsQuery = useRuns({
    page: 1,
    limit: 50,
    payrollPeriodId: period.id,
  });

  const [runOpen, setRunOpen] = useState(false);
  const [confirm, setConfirm] = useState<"finalize" | "cancel" | null>(null);
  const [approving, setApproving] = useState<PayrollRun | null>(null);
  const [viewing, setViewing] = useState<PayrollRun | null>(null);
  const [reopening, setReopening] = useState(false);

  const locked = period.status === "FINALIZED" || period.status === "CANCELLED";
  const rows = runsQuery.data?.data ?? [];
  const hasApprovedRun = rows.some((r) => r.status === "APPROVED");

  // Determine current lifecycle step (1 to 4) using full runs data or summary runs
  const currentStep = lifecycleStep(
    period,
    rows.length > 0 ? rows : period.runs,
  );

  const latestRun = period.runs[0];

  return (
    <div
      className={`rounded-2xl transition-all duration-200 ${
        isExpanded
          ? "border-2 border-brand-500/80 bg-white shadow-lg ring-4 ring-brand-500/10 dark:border-brand-400 dark:bg-slate-900"
          : "border border-slate-200/90 bg-white shadow-2xs hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/90"
      }`}
    >
      {/* Collapsed Header / Summary Row */}
      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Month Icon Badge & Period Metadata */}
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-sky-200/80 bg-sky-50/70 text-brand-600 shadow-2xs dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-300">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-500 dark:text-sky-400 leading-none">
              {MONTH_SHORT[period.month - 1] ?? `M${period.month}`}
            </span>
            <span className="mt-0.5 text-sm font-extrabold text-[#0a3271] dark:text-white leading-tight">
              {period.year}
            </span>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                {periodLabel(period)}
              </h3>
              <PayrollStatusBadge status={period.status} />
              {period.reopenCount && period.reopenCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
                  <RotateCcw className="h-3 w-3" />
                  Reopened ({period.reopenCount})
                </span>
              ) : null}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>
                {isoDate(period.periodStart)} – {isoDate(period.periodEnd)}
              </span>
            </p>
          </div>
        </div>

        {/* Center: Visual 4-Step Mini Pipeline */}
        <div className="hidden xl:flex items-center gap-1.5 rounded-xl border border-slate-200/70 bg-slate-50/80 px-3.5 py-1.5 dark:border-slate-700/60 dark:bg-slate-800/60">
          {PIPELINE_STEPS.map((stepLabel, idx) => {
            const stepNum = idx + 1;
            const isDone = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;

            return (
              <div key={stepLabel} className="flex items-center gap-1.5">
                <div
                  className={`flex items-center gap-1 text-xs font-semibold ${
                    isDone
                      ? "text-emerald-600 dark:text-emerald-400"
                      : isCurrent
                        ? "font-bold text-brand-600 dark:text-sky-300"
                        : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                      isDone
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : isCurrent
                          ? "bg-brand-500 text-white shadow-2xs"
                          : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                    }`}
                  >
                    {isDone ? (
                      <Check className="h-2.5 w-2.5 stroke-3" />
                    ) : (
                      stepNum
                    )}
                  </span>
                  <span>{stepLabel}</span>
                </div>
                {idx < PIPELINE_STEPS.length - 1 ? (
                  <div
                    className={`h-0.5 w-3 rounded-full ${
                      stepNum < currentStep
                        ? "bg-emerald-400 dark:bg-emerald-600"
                        : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Right: Latest Run Snapshot & Manage Toggle */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 pt-2 lg:border-t-0 lg:pt-0 dark:border-slate-800">
          <div className="flex flex-col items-start lg:items-end">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Latest Run
            </span>
            {latestRun ? (
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  #{latestRun.runNumber}
                </span>
                <PayrollStatusBadge status={latestRun.status} />
              </div>
            ) : (
              <span className="mt-0.5 text-xs text-slate-400">
                No runs calculated
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={isExpanded}
            aria-label={`Manage ${periodLabel(period)}`}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all active:scale-95 ${
              isExpanded
                ? "bg-brand-500 text-white shadow-xs hover:bg-brand-600"
                : "border border-sky-200 bg-sky-50 text-[#0a3271] hover:bg-sky-100 hover:text-[#0a3271] dark:border-sky-800 dark:bg-slate-800 dark:text-sky-200 dark:hover:bg-slate-700"
            }`}
          >
            <span>{isExpanded ? "Close Panel" : "Manage"}</span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Command Center */}
      {isExpanded ? (
        <div className="space-y-6 rounded-b-2xl border-t border-slate-100 bg-slate-50/40 p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900/40">
          {/* Milestone & Primary Actions Toolbar */}
          <div className="rounded-xl border border-sky-200/70 bg-linear-to-r from-sky-50/80 via-white to-sky-50/40 p-4 shadow-2xs dark:border-sky-900/50 dark:from-slate-800/80 dark:via-slate-800/40 dark:to-slate-800/80">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white shadow-2xs">
                    {currentStep}
                  </span>
                  <h4 className="text-sm font-bold text-[#0a3271] dark:text-sky-200">
                    Stage {currentStep}: {PIPELINE_STEPS[currentStep - 1]}
                  </h4>
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  {currentStep === 1 &&
                    "Run payroll to calculate gross earnings, deductions, and net pay for this period."}
                  {currentStep === 2 &&
                    "Someone other than the person who ran payroll must review and approve the run."}
                  {currentStep === 3 &&
                    "Finalize the period to generate official payslips and lock all calculations."}
                  {currentStep === 4 &&
                    "Payroll cycle is finalized, payslips are distributed, and period is locked."}
                </p>
              </div>

              {/* Action Buttons Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                {canWrite && !locked ? (
                  <Button
                    size="sm"
                    onClick={() => setRunOpen(true)}
                    className="rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-semibold shadow-xs"
                  >
                    <PlayCircle className="mr-1.5 h-4 w-4" />
                    Run Payroll
                  </Button>
                ) : null}

                {canFinalize && !locked ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!hasApprovedRun}
                    title={
                      hasApprovedRun
                        ? undefined
                        : "Approve a run before finalizing"
                    }
                    onClick={() => setConfirm("finalize")}
                    className="rounded-xl font-semibold border-sky-200 hover:bg-sky-50 dark:border-sky-800"
                  >
                    <CheckCircle2 className="mr-1.5 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Finalize Period
                  </Button>
                ) : null}

                {canWrite && !locked ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirm("cancel")}
                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/30 font-semibold"
                  >
                    <Ban className="mr-1.5 h-4 w-4" />
                    Cancel Period
                  </Button>
                ) : null}

                {canReopen && period.status === "FINALIZED" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setReopening(true)}
                    className="rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 font-semibold"
                  >
                    <RotateCcw className="mr-1.5 h-4 w-4" />
                    Reopen
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Stepper Details */}
            <div className="mt-4 border-t border-sky-100 pt-3 dark:border-slate-700/60">
              <PayrollLifecycle period={period} runs={rows} />
            </div>
          </div>

          {/* Reopened Alert Notice */}
          <ReopenedNotice period={period} />

          {/* Statutory Files & Reports */}
          <PeriodReportsSection
            period={period}
            hasApprovedRun={hasApprovedRun}
          />

          {/* Runs History Table */}
          <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-brand-500" />
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  Payroll Runs History
                </h4>
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-sky-950 dark:text-sky-300">
                  {rows.length} {rows.length === 1 ? "run" : "runs"}
                </span>
              </div>
            </div>

            <QueryState query={runsQuery} area="payroll runs" />

            {runsQuery.isSuccess && rows.length === 0 ? (
              <EmptyState
                title="No runs yet"
                description={
                  canWrite && !locked
                    ? "Run payroll to calculate this period."
                    : "Payroll has not been run for this period."
                }
              />
            ) : null}

            {runsQuery.isSuccess && rows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <th className="pb-2.5 pt-1 font-semibold">Run #</th>
                      <th className="pb-2.5 pt-1 font-semibold">Status</th>
                      <th className="pb-2.5 pt-1 font-semibold">Employees</th>
                      <th className="pb-2.5 pt-1 font-semibold">Initiator</th>
                      <th className="pb-2.5 pt-1 font-semibold">Approver</th>
                      <th className="pb-2.5 pt-1 font-semibold">Notes</th>
                      <th className="pb-2.5 pt-1 text-right font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rows.map((r) => (
                      <tr
                        key={r.id}
                        className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      >
                        <td className="py-3 font-bold text-gray-900 dark:text-white">
                          #{r.runNumber}
                        </td>
                        <td className="py-3">
                          <span className="flex flex-col items-start gap-0.5">
                            <PayrollStatusBadge status={r.status} />
                            {r.status === "CANCELLED" ? (
                              <span className="text-[10px] text-gray-500">
                                Replaced by later run
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="inline-flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
                            <Users className="h-3.5 w-3.5 text-slate-400" />
                            {r._count.entries}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="flex flex-col">
                            <span className="font-medium text-gray-800 dark:text-gray-200">
                              {r.runCreator?.fullName ?? "—"}
                            </span>
                            <span className="text-[11px] text-gray-500">
                              {timestamp(r.completedAt ?? r.startedAt)}
                            </span>
                          </span>
                        </td>
                        <td className="py-3">
                          <span className="flex flex-col">
                            <span className="font-medium text-gray-800 dark:text-gray-200">
                              {r.runApprover?.fullName ?? "—"}
                            </span>
                            {r.approvedAt ? (
                              <span className="text-[11px] text-gray-500">
                                {isoDate(r.approvedAt)}
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className="py-3">
                          {r.notes ? (
                            <span
                              className="line-clamp-2 max-w-40 text-gray-600 dark:text-gray-400"
                              title={r.notes}
                            >
                              {r.notes}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setViewing(r)}
                              className="rounded-lg text-xs"
                            >
                              View entries
                            </Button>
                            {canApprove &&
                            r.status === "PROCESSED" &&
                            !locked ? (
                              r.runCreator && r.runCreator.id === userId ? (
                                <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                                  Maker-checker: need another approver
                                </span>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => setApproving(r)}
                                  className="rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs shadow-2xs"
                                >
                                  Approve
                                </Button>
                              )
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          {/* Action Dialogs */}
          {runOpen ? (
            <RunPayrollDialog
              open
              onClose={() => setRunOpen(false)}
              period={period}
            />
          ) : null}
          {confirm ? (
            <ConfirmPeriodDialog
              open
              onClose={() => setConfirm(null)}
              period={period}
              action={confirm}
            />
          ) : null}
          {approving ? (
            <ApproveRunDialog
              open
              onClose={() => setApproving(null)}
              run={approving}
            />
          ) : null}
          {viewing ? (
            <EntriesDialog run={viewing} onClose={() => setViewing(null)} />
          ) : null}
          {reopening ? (
            <ReopenPeriodDialog
              period={period}
              onClose={() => setReopening(false)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
