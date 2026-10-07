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
import { useApproveCorrection, useRejectCorrection } from "../hooks";
import { decideCorrectionSchema, rejectCorrectionSchema } from "../schema";
import { CORRECTION_TYPE_LABELS } from "../status";
import type { AttendanceCorrectionItem } from "../types";

export interface DecideCorrectionDialogProps {
  open: boolean;
  onClose: () => void;
  correction: Pick<
    AttendanceCorrectionItem,
    "id" | "employee" | "attendanceDate" | "correctionType" | "reason"
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
            ? "Correction approved"
            : "Correction rejected",
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
            {correction.employee.fullName} — {correction.attendanceDate}
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            {CORRECTION_TYPE_LABELS[correction.correctionType]}
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            {correction.reason}
          </p>
        </div>
        {decision === "approve" ? (
          <p className="text-theme-xs text-success-700 dark:text-success-400">
            Approving will update this employee&apos;s attendance for{" "}
            {correction.attendanceDate}. This cannot be undone from here.
          </p>
        ) : null}
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
