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
import { useApproveLeaveRequest, useRejectLeaveRequest } from "../hooks";
import { approveLeaveSchema, rejectLeaveSchema } from "../schema";
import type { LeaveRequestItem } from "../types";

export interface DecideLeaveDialogProps {
  open: boolean;
  onClose: () => void;
  request: Pick<
    LeaveRequestItem,
    | "id"
    | "employee"
    | "leaveType"
    | "startDate"
    | "endDate"
    | "leaveDays"
    | "reason"
  >;
  decision: "approve" | "reject";
}

function describeDecideError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.errorCode === "SELF_APPROVAL_FORBIDDEN") {
      return "You cannot approve or reject your own leave request.";
    }
    if (error.isPermissionError) {
      return "You don't have permission to decide this leave request.";
    }
    if (error.statusCode === 404) {
      return "This leave request is no longer in your approval queue.";
    }
    if (error.errorCode === "INVALID_STATE_TRANSITION") {
      return "This request has already been decided.";
    }
    if (error.errorCode === "LEAVE_BALANCE_INSUFFICIENT") {
      return "This request can no longer be approved — the employee's balance no longer covers it.";
    }
    if (error.isValidationError) {
      return "The note was rejected. Check the character limits and try again.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

/** Approve/reject a PENDING leave request. A rejection note is mandatory; an
 * approval note is optional. Decisions are final — maker-checker is enforced
 * server-side (403 SELF_APPROVAL_FORBIDDEN), never by this dialog. */
export function DecideLeaveDialog({
  open,
  onClose,
  request,
  decision,
}: DecideLeaveDialogProps) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const approve = useApproveLeaveRequest();
  const reject = useRejectLeaveRequest();
  const { toast } = useToast();

  const mutation = decision === "approve" ? approve : reject;
  const submitting = mutation.isPending;
  const title = decision === "approve" ? "Approve leave" : "Reject leave";
  const schema =
    decision === "approve" ? approveLeaveSchema : rejectLeaveSchema;

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
      if (decision === "approve") {
        await approve.mutateAsync({
          id: request.id,
          body: result.data.note ? { note: result.data.note } : {},
        });
      } else {
        await reject.mutateAsync({
          id: request.id,
          body: { note: result.data.note },
        });
      }
      toast({
        title: decision === "approve" ? "Leave approved" : "Leave rejected",
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
        <div className="flex flex-col gap-1 rounded-lg bg-gray-50 p-3 text-theme-sm dark:bg-gray-800">
          <p className="font-medium text-gray-900 dark:text-white/90">
            {request.employee.fullName} — {request.leaveType.name}
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            {request.startDate} – {request.endDate} ({request.leaveDays} day
            {request.leaveDays === 1 ? "" : "s"})
          </p>
          <p className="text-gray-600 dark:text-gray-400">{request.reason}</p>
        </div>
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
