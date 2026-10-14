"use client";

import { useState } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import { formatTime } from "@/features/hr/attendance/status";
import { useApproveCorrection, useRejectCorrection } from "../hooks";
import { decideCorrectionSchema, rejectCorrectionSchema } from "../schema";
import { CORRECTION_TYPE_LABELS } from "../status";
import type { AttendanceCorrectionItem } from "../types";

export interface DecideCorrectionDialogProps {
  open: boolean;
  onClose: () => void;
  correction: Pick<
    AttendanceCorrectionItem,
    | "id"
    | "employee"
    | "attendanceDate"
    | "correctionType"
    | "reason"
    | "requestedCheckInAt"
    | "requestedCheckOutAt"
  >;
  decision: "approve" | "reject";
}

function describeDecideError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.errorCode === "SELF_APPROVAL_FORBIDDEN") {
      return "You cannot approve or reject your own attendance correction.";
    }
    if (error.isPermissionError) {
      return "You don't have permission to decide this correction.";
    }
    if (error.statusCode === 404) {
      return "This correction is no longer in your approval queue.";
    }
    if (error.errorCode === "INVALID_STATE_TRANSITION") {
      return "This correction has already been decided.";
    }
    if (error.errorCode === "CORRECTION_NOT_APPLICABLE") {
      return "This correction can no longer be applied to the day's punches.";
    }
    if (error.isValidationError) {
      return "The note was rejected. Check the character limits and try again.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

/** Approve/reject a SUBMITTED correction. A rejection note is mandatory
 * (RejectAttendanceCorrectionDto); an approval note is optional
 * (ApproveAttendanceCorrectionDto). Decisions are final. */
export function DecideCorrectionDialog({
  open,
  onClose,
  correction,
  decision,
}: DecideCorrectionDialogProps) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const approve = useApproveCorrection();
  const reject = useRejectCorrection();
  const { toast } = useToast();

  const mutation = decision === "approve" ? approve : reject;
  const submitting = mutation.isPending;
  const title =
    decision === "approve" ? "Approve correction" : "Reject correction";
  const schema =
    decision === "approve" ? decideCorrectionSchema : rejectCorrectionSchema;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = schema.safeParse({ note });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid note");
      return;
    }
    setError(null);
    setServerError(null);
    try {
      await mutation.mutateAsync({
        id: correction.id,
        body: result.data.note ? { note: result.data.note } : {},
      });
      toast({
        title:
          decision === "approve"
            ? "Correction approved successfully"
            : "Correction rejected",
        variant: "success",
      });
      setNote("");
      onClose();
    } catch (err) {
      setServerError(describeDecideError(err));
    }
  }

  const hasIn = Boolean(correction.requestedCheckInAt);
  const hasOut = Boolean(correction.requestedCheckOutAt);

  return (
    <Dialog open={open} onClose={onClose} title={title} size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {/* Request Context Card */}
        <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-3.5 text-theme-sm dark:border-gray-800 dark:bg-gray-800/50">
          <div className="flex items-center justify-between gap-2 border-b border-gray-200/60 pb-2.5 dark:border-gray-700/50">
            <EmployeeIdentity
              name={correction.employee.fullName}
              code={correction.employee.employeeCode}
              size="sm"
            />
            <span className="text-theme-xs font-semibold text-gray-700 dark:text-gray-300">
              {correction.attendanceDate}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-theme-xs font-semibold text-brand-700 dark:text-brand-300">
                {CORRECTION_TYPE_LABELS[correction.correctionType]}
              </span>
              {hasIn || hasOut ? (
                <div className="flex items-center gap-2 font-mono text-[11px] text-gray-600 dark:text-gray-400">
                  <Clock className="h-3 w-3 text-gray-400" />
                  {hasIn ? (
                    <span>
                      In: {formatTime(correction.requestedCheckInAt!)}
                    </span>
                  ) : null}
                  {hasIn && hasOut ? <span>•</span> : null}
                  {hasOut ? (
                    <span>
                      Out: {formatTime(correction.requestedCheckOutAt!)}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            <p className="rounded-lg bg-white/80 p-2.5 text-theme-xs text-gray-600 italic dark:bg-gray-900/40 dark:text-gray-300 border border-gray-100 dark:border-gray-800">
              &ldquo;{correction.reason}&rdquo;
            </p>
          </div>
        </div>

        {decision === "approve" ? (
          <div className="flex items-start gap-2 rounded-lg bg-emerald-50/70 p-3 text-theme-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/40">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            <span>
              Approving will update this employee&apos;s attendance for{" "}
              <strong>{correction.attendanceDate}</strong>. This action cannot
              be undone from here.
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50/70 p-3 text-theme-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/50 dark:border-rose-800/40">
            <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <span>
              Rejecting will decline this correction request. The employee will
              receive the rejection note below.
            </span>
          </div>
        )}

        <FormField
          label={
            decision === "approve" ? "Note to the employee" : "Rejection reason"
          }
          required={decision === "reject"}
          hint={
            decision === "approve"
              ? "Optional. 3–500 characters if provided."
              : "Required. 3–500 characters."
          }
          error={error ?? undefined}
        >
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              invalid={f.invalid}
              value={note}
              disabled={submitting}
              placeholder={
                decision === "approve"
                  ? "Add an optional note..."
                  : "Explain why this request is being rejected..."
              }
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </FormField>

        {serverError ? (
          <Alert variant="error" title="Could not submit decision">
            {serverError}
          </Alert>
        ) : null}

        <div className="flex justify-end gap-2.5 pt-2 border-t border-gray-100 dark:border-gray-800">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant={decision === "reject" ? "destructive" : "primary"}
            loading={submitting}
          >
            {decision === "approve" ? "Approve" : "Reject"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
