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
        <div className="flex flex-col gap-2 rounded-xl border border-gray-200/80 bg-gray-50/70 p-3.5 text-theme-sm dark:border-gray-800 dark:bg-gray-800/60">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-900 dark:text-white/90">
              {request.employee.fullName}
            </span>
            <span className="rounded bg-gray-200/60 px-1.5 py-0.5 font-mono text-theme-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {request.employee.employeeCode}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-theme-xs text-gray-600 dark:text-gray-400">
            <span className="font-medium text-gray-800 dark:text-gray-200">
              {request.leaveType.name}
            </span>
            <span>•</span>
            <span>
              {request.startDate} – {request.endDate}
            </span>
            <span>•</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {request.leaveDays} day{request.leaveDays === 1 ? "" : "s"}
            </span>
          </div>
          <p className="text-theme-xs italic text-gray-600 dark:text-gray-400">
            &ldquo;{request.reason}&rdquo;
          </p>
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
              placeholder={
                decision === "approve"
                  ? "Add an optional note to the employee..."
                  : "State the reason for rejecting this leave request..."
              }
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
