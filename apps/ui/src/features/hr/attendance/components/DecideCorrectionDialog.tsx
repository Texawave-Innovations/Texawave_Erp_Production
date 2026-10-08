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
import {
  useApproveAttendanceCorrection,
  useRejectAttendanceCorrection,
} from "../hooks";
import { approveCorrectionSchema, rejectCorrectionSchema } from "../schema";
import { CORRECTION_TYPE_LABELS } from "../status";
import type { AttendanceCorrection } from "../types";

export interface DecideCorrectionDialogProps {
  open: boolean;
  onClose: () => void;
  correction: AttendanceCorrection;
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
      return "This correction is no longer in your scope.";
    }
    if (error.errorCode === "INVALID_STATE_TRANSITION") {
      return "This correction has already been decided.";
    }
    if (error.isValidationError) {
      return "The note was rejected. Check the length and try again.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

/** Approve applies the requested punch change to the day's attendance record
 * in the same transaction (server-side); reject leaves attendance untouched.
 * Both are final — `attendance-corrections.repository.ts` `decide()` only
 * succeeds once, from SUBMITTED. */
export function DecideCorrectionDialog({
  open,
  onClose,
  correction,
  decision,
}: DecideCorrectionDialogProps) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const approve = useApproveAttendanceCorrection();
  const reject = useRejectAttendanceCorrection();
  const { toast } = useToast();

  const mutation = decision === "approve" ? approve : reject;
  const submitting = mutation.isPending;
  const title =
    decision === "approve" ? "Approve correction" : "Reject correction";
  const schema =
    decision === "approve" ? approveCorrectionSchema : rejectCorrectionSchema;

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
        <p className="text-theme-sm text-gray-600 dark:text-gray-400">
          {correction.employee.fullName} — {correction.attendanceDate} (
          {CORRECTION_TYPE_LABELS[correction.correctionType]}). This decision is
          final once saved.
        </p>
        <p className="text-theme-sm text-gray-700 dark:text-gray-300">
          {correction.reason}
        </p>
        <FormField
          label="Note to the employee"
          required={decision === "reject"}
          hint={
            decision === "reject"
              ? "Required. 3–500 characters."
              : "Optional. 3–500 characters if provided."
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
