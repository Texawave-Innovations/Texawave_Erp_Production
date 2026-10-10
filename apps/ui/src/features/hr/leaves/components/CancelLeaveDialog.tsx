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
import { useCancelMyLeaveRequest } from "../hooks";
import { cancelLeaveSchema } from "../schema";
import type { LeaveRequestItem } from "../types";

export interface CancelLeaveDialogProps {
  open: boolean;
  onClose: () => void;
  request: Pick<LeaveRequestItem, "id" | "startDate" | "endDate" | "leaveType">;
}

function describeCancelError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isPermissionError) {
      return "You don't have permission to cancel leave requests.";
    }
    if (error.statusCode === 404) {
      return "This leave request is no longer yours to cancel.";
    }
    if (error.errorCode === "INVALID_STATE_TRANSITION") {
      return "This request can no longer be cancelled — it may have already started, been decided, or already been cancelled.";
    }
    if (error.isValidationError) {
      return "The note was rejected. Check the character limits and try again.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

/** Withdraws a PENDING request any time, or an APPROVED one only while its
 * start date is still in the future (Docs/HR_LEAVE.md §2, D7). The dialog
 * itself does not re-check that rule — the list only offers this action when
 * `canCancel()` allows it, and the backend re-checks regardless. */
export function CancelLeaveDialog({
  open,
  onClose,
  request,
}: CancelLeaveDialogProps) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const mutation = useCancelMyLeaveRequest();
  const { toast } = useToast();

  const submitting = mutation.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = cancelLeaveSchema.safeParse({ note });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid note");
      return;
    }
    setError(null);
    setServerError(null);
    try {
      await mutation.mutateAsync({
        id: request.id,
        body: result.data.note ? { note: result.data.note } : {},
      });
      toast({ title: "Leave request cancelled", variant: "success" });
      setNote("");
      onClose();
    } catch (err) {
      setServerError(describeCancelError(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Cancel leave request">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5 rounded-xl border border-gray-200/80 bg-gray-50/70 p-3.5 text-theme-sm dark:border-gray-800 dark:bg-gray-800/60">
          <p className="font-semibold text-gray-900 dark:text-white/90">
            {request.leaveType.name}
          </p>
          <p className="text-theme-xs text-gray-600 dark:text-gray-400">
            Dates: {request.startDate} – {request.endDate}
          </p>
        </div>

        <FormField
          label="Note (optional)"
          hint="Optional. 3–500 characters if provided."
          labelAction={
            <span className="text-theme-xs font-mono text-gray-400 dark:text-gray-500">
              {note.length}/500
            </span>
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
              placeholder="Add an optional reason for cancellation..."
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </FormField>

        {serverError ? (
          <p
            role="alert"
            className="text-theme-xs font-medium text-error-600 dark:text-error-400"
          >
            {serverError}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Back
          </Button>
          <Button type="submit" variant="destructive" loading={submitting}>
            Cancel request
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
