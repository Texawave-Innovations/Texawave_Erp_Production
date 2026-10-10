"use client";

import { useState } from "react";
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
import { useApproveWorkLog, useRejectWorkLog } from "../hooks";
import { decideWorkLogSchema } from "../schema";
import type { WorkLogItem } from "../types";

export interface DecideWorkLogDialogProps {
  open: boolean;
  onClose: () => void;
  workLog: Pick<WorkLogItem, "id" | "employee" | "workDate" | "hoursWorked">;
  decision: "approve" | "reject";
}

function describeDecideError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.errorCode === "SELF_APPROVAL_FORBIDDEN") {
      return "You cannot approve or reject your own work log.";
    }
    if (error.isPermissionError) {
      return "You don't have permission to decide this work log.";
    }
    if (error.statusCode === 404) {
      return "This work log is no longer in your approval queue.";
    }
    if (error.errorCode === "INVALID_STATE_TRANSITION") {
      return "This work log has already been decided.";
    }
    if (error.isValidationError) {
      return "The note was rejected. Use 3–500 characters, or leave it empty.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

/** Approve/reject a PENDING log with an optional note. Decisions are final. */
export function DecideWorkLogDialog({
  open,
  onClose,
  workLog,
  decision,
}: DecideWorkLogDialogProps) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const approve = useApproveWorkLog();
  const reject = useRejectWorkLog();
  const { toast } = useToast();

  const mutation = decision === "approve" ? approve : reject;
  const submitting = mutation.isPending;
  const title = decision === "approve" ? "Approve work log" : "Reject work log";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = decideWorkLogSchema.safeParse({ note });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid note");
      return;
    }
    setError(null);
    setServerError(null);
    try {
      await mutation.mutateAsync({
        id: workLog.id,
        body: result.data.note ? { note: result.data.note } : {},
      });
      toast({
        title:
          decision === "approve" ? "Work log approved" : "Work log rejected",
        variant: "success",
      });
      setNote("");
      onClose();
    } catch (err) {
      setServerError(describeDecideError(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={title} size="md">
      <div className="flex flex-col gap-4">
        {/* Context Card */}
        <div className="flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50/70 p-3.5 dark:border-gray-800 dark:bg-gray-900/60">
          <div className="flex items-center justify-between gap-3">
            <EmployeeIdentity
              name={workLog.employee.fullName}
              avatarSize="sm"
              size="sm"
            />
            <span className="inline-flex items-center px-2 py-0.5 rounded text-theme-xs font-semibold bg-white text-gray-800 dark:bg-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 font-mono">
              {workLog.hoursWorked} hrs
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-200/60 dark:border-gray-800">
            <span>Work date: {workLog.workDate}</span>
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              Decision is final once saved
            </span>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
          noValidate
        >
          <FormField
            label="Note to the employee"
            hint="Optional. 3–500 characters if provided."
            error={error ?? undefined}
            labelAction={
              <span
                className={`text-[11px] font-mono ${
                  note.length > 500
                    ? "text-error-600 dark:text-error-400 font-semibold"
                    : "text-gray-400 dark:text-gray-500"
                }`}
              >
                {note.length}/500
              </span>
            }
          >
            {(f) => (
              <Textarea
                {...f}
                rows={3}
                placeholder={
                  decision === "approve"
                    ? "Optional acknowledgment or notes for the employee..."
                    : "Provide a reason or feedback for the rejection..."
                }
                invalid={f.invalid}
                value={note}
                disabled={submitting}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
          </FormField>

          {serverError ? (
            <Alert variant="error" title="Could not process decision">
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
              className={
                decision === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : undefined
              }
              loading={submitting}
            >
              {decision === "approve" ? "Approve" : "Reject"}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
