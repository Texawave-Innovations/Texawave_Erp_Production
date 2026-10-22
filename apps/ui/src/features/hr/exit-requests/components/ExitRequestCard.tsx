"use client";

import { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Loader2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  FormField,
  Input,
  Select,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { useUpdateExitRequest } from "../hooks";
import { decideExitRequestSchema } from "../schema";
import { SETTLEMENT_LABELS, STATUS_LABELS } from "../status";
import {
  SETTLEMENT_STATUSES,
  TRANSITIONS,
  type ExitRequestItem,
  type ExitRequestStatus,
  type SettlementStatus,
} from "../types";
import { ExitRequestStatusBadge } from "./ExitRequestStatusBadge";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function describeReviewError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.errorCode === "SELF_DECISION_FORBIDDEN") {
      return "You cannot decide your own exit request.";
    }
    if (error.errorCode === "DECISION_SCOPE_REQUIRED") {
      return "Deciding an exit request requires team or organization scope.";
    }
    if (error.isPermissionError) {
      return "You don't have permission to review this exit request.";
    }
    if (error.statusCode === 404) {
      return "This exit request is no longer in your scope.";
    }
    if (error.errorCode === "INVALID_STATE_TRANSITION") {
      return "This status change is not allowed for the request's current state.";
    }
    if (error.errorCode === "NO_CHANGES") {
      return "Change at least one field before saving.";
    }
    if (error.isValidationError) {
      return "The server rejected some values. Check the fields and try again.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

export interface ExitRequestCardProps {
  request: ExitRequestItem;
  canDecide: boolean;
  onUpdated?: () => void;
}

export function ExitRequestCard({
  request,
  canDecide,
  onUpdated,
}: ExitRequestCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const nextStatuses = TRANSITIONS[request.status];
  const isTerminal = nextStatuses.length === 0;

  // Form edit states
  const [status, setStatus] = useState<"" | ExitRequestStatus>("");
  const [confirmedLastWorkingDate, setConfirmedLastWorkingDate] = useState(
    request.confirmedLastWorkingDate ?? "",
  );
  const [settlementStatus, setSettlementStatus] = useState<"" | SettlementStatus>(
    request.settlementStatus ?? "",
  );
  const [hrNote, setHrNote] = useState(request.hrNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const updateMutation = useUpdateExitRequest();
  const { toast } = useToast();
  const isSubmitting = updateMutation.isPending;

  const handleToggleExpand = () => {
    if (!isExpanded) {
      // Reset form to current request values
      setStatus("");
      setConfirmedLastWorkingDate(request.confirmedLastWorkingDate ?? "");
      setSettlementStatus(request.settlementStatus ?? "");
      setHrNote(request.hrNote ?? "");
      setError(null);
      setServerError(null);
    }
    setIsExpanded((prev) => !prev);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setServerError(null);

    const result = decideExitRequestSchema.safeParse({
      confirmedLastWorkingDate,
      settlementStatus,
      hrNote,
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid value");
      return;
    }

    const payload: {
      status?: ExitRequestStatus;
      confirmedLastWorkingDate?: string;
      settlementStatus?: SettlementStatus;
      hrNote?: string;
    } = {};

    if (status) payload.status = status;
    if (confirmedLastWorkingDate) {
      payload.confirmedLastWorkingDate = confirmedLastWorkingDate;
    }
    if (settlementStatus) {
      payload.settlementStatus = settlementStatus;
    }
    if (hrNote !== (request.hrNote ?? "")) {
      payload.hrNote = hrNote;
    }

    if (Object.keys(payload).length === 0) {
      setError("Change at least one field before saving.");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: request.id,
        body: payload,
      });
      toast({
        title: "Exit request updated",
        description: "Status and decision details saved successfully.",
        variant: "success",
      });
      setIsExpanded(false);
      onUpdated?.();
    } catch (err) {
      setServerError(describeReviewError(err));
    }
  };

  return (
    <div className="overflow-visible rounded-2xl border border-sky-200/90 bg-white shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] transition-all duration-200 hover:shadow-[0_8px_30px_-6px_rgba(23,105,245,0.12)] dark:border-slate-700/80 dark:bg-gray-900">
      {/* Card Header & Summary */}
      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Employee Identity & Status */}
          <div className="flex items-start gap-3.5">
            <EmployeeIdentity
              name={request.employee.fullName}
              code={request.employee.employeeCode ?? `EMP${String(request.employee.id).padStart(4, "0")}`}
              avatarUrl={request.employee.avatarUrl}
              size="md"
            />
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-bold text-[#0a3271] dark:text-white">
                  {request.employee.fullName}
                </span>
                <span className="inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-[#0284c7] dark:border-slate-700 dark:bg-slate-800 dark:text-sky-300">
                  {request.employee.employeeCode ?? `EMP${String(request.employee.id).padStart(4, "0")}`}
                </span>
                <ExitRequestStatusBadge status={request.status} />
              </div>

              {/* Resignation Reason */}
              {request.reason ? (
                <p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-300 line-clamp-2">
                  <span className="font-semibold text-[#0a3271] dark:text-sky-200">Reason: </span>
                  {request.reason}
                </p>
              ) : null}
            </div>
          </div>

          {/* Action Button: Manage / Close */}
          {canDecide ? (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant={isExpanded ? "secondary" : "secondary"}
                size="sm"
                onClick={handleToggleExpand}
                className={
                  isExpanded
                    ? "rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 hover:text-rose-800 transition-colors dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
                    : "rounded-xl border border-sky-200/90 bg-sky-50 px-3.5 py-1.5 text-xs font-bold text-[#0284c7] shadow-2xs hover:bg-sky-100/90 hover:text-[#0284c7] hover:border-sky-300 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-sky-200 dark:hover:bg-slate-700"
                }
              >
                {isExpanded ? (
                  <>
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    Close
                  </>
                ) : (
                  <>
                    <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                    Manage
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </div>

        {/* Milestones & Key Info Chips */}
        <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-sky-100 text-[11px] font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <Clock className="h-3 w-3 text-brand-500" />
            <span>Submitted: {formatDate(request.createdAt)}</span>
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50/70 px-2.5 py-1 text-[#0284c7] dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300">
            <Calendar className="h-3 w-3 text-[#0284c7]" />
            <span>Preferred LWD: {formatDate(request.preferredLastWorkingDate)}</span>
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <span>Notice: {request.noticePeriodDays} days</span>
          </span>

          {request.confirmedLastWorkingDate ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              <span>Confirmed LWD: {formatDate(request.confirmedLastWorkingDate)}</span>
            </span>
          ) : null}

          {request.settlementStatus ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 font-bold text-[#0a3271] dark:border-slate-700 dark:bg-slate-800 dark:text-sky-200">
              <DollarSign className="h-3 w-3 text-brand-500" />
              <span>Settlement: {SETTLEMENT_LABELS[request.settlementStatus]}</span>
            </span>
          ) : null}

          {request.decidedBy ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              <span>Decided by: {request.decidedBy.fullName}</span>
            </span>
          ) : null}
        </div>

        {/* Existing HR Note */}
        {request.hrNote ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-sky-100 bg-[#f8fbff] p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
            <div className="min-w-0">
              <span className="font-bold text-[#0a3271] dark:text-sky-200">HR Note: </span>
              <span>{request.hrNote}</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Expanded Inline Review Form (Matches Reference Image 2) */}
      {isExpanded ? (
        <div className="border-t border-sky-200/80 bg-linear-to-b from-[#f8fbff] to-white p-5 sm:p-6 rounded-b-2xl dark:border-slate-700 dark:from-slate-850 dark:to-slate-900">
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-sky-100 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#0a3271] dark:text-sky-200">
                Manage Exit Request & Decisions
              </h4>
              <span className="text-[11px] font-medium text-slate-500">
                Current status: <strong className="text-[#0a3271] dark:text-white">{STATUS_LABELS[request.status]}</strong>
              </span>
            </div>

            {error ? <Alert variant="error" title={error} /> : null}
            {serverError ? <Alert variant="error" title={serverError} /> : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Status transition */}
              <FormField
                label="New Status"
                hint={isTerminal ? "Final state reached" : "Select next status transition"}
              >
                {(f) => (
                  <Select
                    {...f}
                    aria-label="New status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "" | ExitRequestStatus)}
                    disabled={isTerminal || isSubmitting}
                    className="rounded-xl border border-sky-200/90 bg-white dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="">Keep current ({STATUS_LABELS[request.status]})</option>
                    {nextStatuses.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>

              {/* Confirmed Last Working Date */}
              <FormField
                label="Confirmed Last Working Date"
                hint="Final agreed exit date"
              >
                {(f) => (
                  <Input
                    {...f}
                    type="date"
                    aria-label="Confirmed last working date"
                    value={confirmedLastWorkingDate}
                    onChange={(e) => setConfirmedLastWorkingDate(e.target.value)}
                    disabled={isSubmitting}
                    className="rounded-xl border border-sky-200/90 bg-white dark:border-slate-700 dark:bg-slate-800"
                  />
                )}
              </FormField>

              {/* Settlement Status */}
              <FormField
                label="Settlement Status"
                hint="Full and final settlement progress"
              >
                {(f) => (
                  <Select
                    {...f}
                    aria-label="Settlement status"
                    value={settlementStatus}
                    onChange={(e) =>
                      setSettlementStatus(e.target.value as "" | SettlementStatus)
                    }
                    disabled={isSubmitting}
                    className="rounded-xl border border-sky-200/90 bg-white dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="">Unspecified</option>
                    {SETTLEMENT_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {SETTLEMENT_LABELS[st]}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>

              {/* Notice Period days info */}
              <FormField
                label="Notice Period (Recorded)"
                hint="Provided during submission"
              >
                {(f) => (
                  <Input
                    {...f}
                    type="text"
                    readOnly
                    disabled
                    value={`${request.noticePeriodDays} days`}
                    className="rounded-xl border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800"
                  />
                )}
              </FormField>
            </div>

            {/* HR Note */}
            <FormField
              label="HR Note"
              hint="Audit comments visible to the employee"
            >
              {(f) => (
                <Textarea
                  {...f}
                  aria-label="HR note"
                  value={hrNote}
                  onChange={(e) => setHrNote(e.target.value)}
                  placeholder="Enter exit interview notes, handover details, or settlement clearance remarks..."
                  rows={3}
                  disabled={isSubmitting}
                  className="rounded-xl border border-sky-200/90 bg-white dark:border-slate-700 dark:bg-slate-800"
                />
              )}
            </FormField>

            {/* Actions Footer */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-sky-100 dark:border-slate-800">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleToggleExpand}
                disabled={isSubmitting}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="rounded-xl bg-brand-500 hover:bg-[#0284c7] px-5 py-2 text-xs font-bold text-white shadow-xs transition-all active:scale-95"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
