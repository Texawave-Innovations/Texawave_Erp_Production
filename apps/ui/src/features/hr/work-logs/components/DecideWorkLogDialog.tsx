"use client";

import { useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Button,
  Dialog,
  FormField,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
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
    <Dialog open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <p className="text-theme-sm text-gray-600 dark:text-gray-400">
          {workLog.employee.fullName} — {workLog.workDate} (
          {workLog.hoursWorked}h). This decision is final once saved.
        </p>
        <FormField
          label="Note to the employee"
          hint="Optional. 3–500 characters if provided."
          error={error ?? undefined}
        >
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              invalid={f.invalid}
              value={note}
              disabled={submitting}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </FormField>
        {serverError ? (
          <p
            role="alert"
            className="text-theme-xs text-error-600 dark:text-error-400"
          >
            {serverError}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
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
