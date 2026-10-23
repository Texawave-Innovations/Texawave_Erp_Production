"use client";

import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  X,
  XCircle,
} from "lucide-react";
import { Button, cn } from "@texawave-erp/ui-kit";
import { formatTime } from "@/features/hr/attendance/status";
import { CORRECTION_TYPE_LABELS } from "../status";
import type { AttendanceCorrectionItem } from "../types";

export interface RegularizationCardProps {
  correction: AttendanceCorrectionItem;
  canApprove: boolean;
  onApprove: (item: AttendanceCorrectionItem) => void;
  onReject: (item: AttendanceCorrectionItem) => void;
}

function formatFriendlyDate(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T00:00:00Z`);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      weekday: "long",
      timeZone: "UTC",
    }).format(d);
  } catch {
    return dateStr;
  }
}

function formatTimestamp(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return "";
  }
}

export function RegularizationCard({
  correction,
  canApprove,
  onApprove,
  onReject,
}: RegularizationCardProps) {
  const isPending = correction.status === "SUBMITTED";
  const isApproved = correction.status === "APPROVED";
  const isRejected = correction.status === "REJECTED";

  const hasIn = Boolean(correction.requestedCheckInAt);
  const hasOut = Boolean(correction.requestedCheckOutAt);

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between gap-4 rounded-2xl border p-4.5 sm:p-5 transition-all",
        "bg-white/95 backdrop-blur-md shadow-2xs hover:shadow-xs",
        "dark:bg-gray-900/90 dark:border-gray-800",
        isPending && "border-amber-200/80 hover:border-amber-300 dark:border-amber-900/40",
        isApproved && "border-emerald-200/80 hover:border-emerald-300 dark:border-emerald-900/40",
        isRejected && "border-rose-200/80 hover:border-rose-300 dark:border-rose-900/40",
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        {/* Left identity & details */}
        <div className="flex items-start gap-3.5 min-w-0">
          {/* Status Indicator Icon */}
          <div className="mt-0.5 shrink-0">
            {isPending && (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200/80 dark:bg-amber-950/60 dark:border-amber-900/40 dark:text-amber-400">
                <AlertCircle className="h-5 w-5" />
              </div>
            )}
            {isApproved && (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 dark:bg-emerald-950/60 dark:border-emerald-900/40 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            )}
            {isRejected && (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-200/80 dark:bg-rose-950/60 dark:border-rose-900/40 dark:text-rose-400">
                <XCircle className="h-5 w-5" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col gap-1.5 min-w-0">
            {/* Header info */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-gray-900 dark:text-white text-theme-sm">
                {correction.employee.fullName}
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {correction.employee.employeeCode}
              </span>

              {/* Correction Type Pill */}
              <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 border border-sky-200/80 dark:bg-sky-950/50 dark:border-sky-900/50 dark:text-sky-300">
                {CORRECTION_TYPE_LABELS[correction.correctionType]}
              </span>

              {/* Status Pill */}
              {isPending && (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300">
                  Pending
                </span>
              )}
              {isApproved && (
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300">
                  Approved
                </span>
              )}
              {isRejected && (
                <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200/80 dark:bg-rose-950/50 dark:text-rose-300">
                  Rejected
                </span>
              )}
            </div>

            {/* Date & Requested Punches */}
            <div className="flex flex-wrap items-center gap-2 text-theme-xs">
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {formatFriendlyDate(correction.attendanceDate)}
              </span>

              {(hasIn || hasOut) && (
                <div className="flex items-center gap-1.5 font-semibold text-brand-600 dark:text-sky-400 bg-sky-50/70 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-sky-100 dark:border-slate-700">
                  <Clock className="h-3.5 w-3.5 text-brand-500 shrink-0" />
                  <span>
                    {hasIn ? `Check-in: ${formatTime(correction.requestedCheckInAt!)}` : ""}
                    {hasIn && hasOut ? " • " : ""}
                    {hasOut ? `Check-out: ${formatTime(correction.requestedCheckOutAt!)}` : ""}
                  </span>
                </div>
              )}
            </div>

            {/* Reason */}
            {correction.reason ? (
              <p className="text-theme-xs text-gray-600 dark:text-gray-300 leading-relaxed max-w-2xl mt-0.5">
                {correction.reason}
              </p>
            ) : null}

            {/* Audit Log / Decision Note */}
            {correction.decidedBy ? (
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                <span>
                  {isApproved ? "Approved" : "Rejected"} by{" "}
                  <strong className="text-gray-700 dark:text-gray-200 font-semibold">
                    {correction.decidedBy.fullName}
                  </strong>
                  {correction.decidedAt ? ` on ${formatTimestamp(correction.decidedAt)}` : ""}
                </span>
                {correction.decisionNote ? (
                  <span className="italic text-gray-600 dark:text-gray-300">
                    — &ldquo;{correction.decisionNote}&rdquo;
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {/* Right side: Timestamp & Actions */}
        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800">
          {/* Submission Timestamp */}
          <span className="text-theme-xs font-medium text-gray-400 dark:text-gray-500">
            {formatTimestamp(correction.createdAt)}
          </span>

          {/* Direct Approval Actions (for authorized users on pending requests) */}
          {canApprove && isPending ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onReject(correction)}
                className="h-8.5 px-3 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200/80 dark:border-rose-900/50 dark:hover:bg-rose-950/40 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>Reject</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => onApprove(correction)}
                className="h-8.5 px-3.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Approve</span>
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
