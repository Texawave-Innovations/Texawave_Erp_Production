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
import type { MonthDecision } from "../api";
import { useDecideMonth } from "../hooks";
import type { MonthLockRow } from "../types";

const COPY: Record<
  MonthDecision,
  { title: string; action: string; hint: string; done: string }
> = {
  approve: {
    title: "Approve attendance month",
    action: "Approve",
    hint: "Approving locks the month: no punch, status or correction in it can change until it is reopened.",
    done: "Month approved",
  },
  return: {
    title: "Return attendance month",
    action: "Return",
    hint: "The month becomes editable again. Say what needs fixing; the person who submitted it is notified.",
    done: "Month returned",
  },
  reopen: {
    title: "Reopen approved month",
    action: "Reopen",
    hint: "The month becomes editable and must be submitted and approved again. Give the reason; the submitter is notified.",
    done: "Month reopened",
  },
};

export function describeMonthError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.errorCode) {
      case "SUBMITTER_CANNOT_DECIDE":
        return "You submitted this month, so someone else must approve or return it.";
      case "SELF_APPROVAL_FORBIDDEN":
        return "You cannot decide your own attendance month.";
      case "INVALID_STATE_TRANSITION":
        return "This month has already been decided by someone else. Refresh to see its status.";
      case "MONTH_NOT_COMPLETE":
        return "A month can be submitted only after it has ended.";
    }
    if (error.isPermissionError) return "You don't have permission to do this.";
    if (error.statusCode === 404)
      return "This month is no longer in your scope.";
    if (error.isValidationError && error.fieldErrors.length > 0)
      return error.fieldErrors.join(" ");
    return error.message;
  }
  return "Something went wrong. Try again.";
}

/** Approve (optional note), return or reopen (note required, 3–1000 chars,
 * mirroring the API DTOs). */
export function MonthDecisionDialog({
  row,
  decision,
  onClose,
}: {
  row: MonthLockRow;
  decision: MonthDecision;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const mutation = useDecideMonth();
  const { toast } = useToast();
  const copy = COPY[decision];
  const required = decision !== "approve";

  async function submit() {
    const trimmed = note.trim();
    if (required && (trimmed.length < 3 || trimmed.length > 1000)) {
      setNoteError("Write 3 to 1000 characters.");
      return;
    }
    if (trimmed.length > 1000) {
      setNoteError("Keep the note under 1000 characters.");
      return;
    }
    setServerError(null);
    try {
      await mutation.mutateAsync({
        id: row.id as number,
        decision,
        note: trimmed,
      });
      toast({ title: copy.done, variant: "success" });
      onClose();
    } catch (error) {
      setServerError(describeMonthError(error));
    }
  }

  return (
    <Dialog open onClose={onClose} title={copy.title} size="md">
      <div className="flex flex-col gap-4">
        <p className="text-theme-sm text-gray-700 dark:text-gray-300">
          <span className="font-semibold">{row.employee.fullName}</span> (
          {row.employee.employeeCode}) · {row.month}
        </p>
        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          {copy.hint}
        </p>
        <FormField
          label={required ? "Reason" : "Note (optional)"}
          required={required}
          error={noteError ?? undefined}
        >
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              value={note}
              invalid={f.invalid}
              onChange={(e) => {
                setNote(e.target.value);
                setNoteError(null);
              }}
            />
          )}
        </FormField>
        {serverError ? (
          <Alert variant="error" title="Not saved">
            {serverError}
          </Alert>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            loading={mutation.isPending}
            onClick={() => void submit()}
          >
            {copy.action}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
