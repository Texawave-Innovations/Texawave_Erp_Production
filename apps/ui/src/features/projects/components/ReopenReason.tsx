"use client";

import { useState } from "react";
import { Button, Dialog, FormField, Textarea } from "@texawave-erp/ui-kit";

/** Longest reason the API accepts (`statusChangeReason`, 500 characters). */
export const REOPEN_REASON_MAX = 500;

/** Moving a task OUT of "completed" un-completes finished work, so the API
 * requires a reason and records it in the task's history. */
export function isReopen(currentStatus: string, nextStatus: string): boolean {
  return currentStatus === "completed" && nextStatus !== "completed";
}

/** Inline field for forms that already contain the status control. */
export function ReopenReasonField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FormField
      label="Reason for reopening"
      required
      hint="Recorded in the task's history. The task was completed, so changing its status needs an explanation."
    >
      {(field) => (
        <Textarea
          {...field}
          rows={2}
          maxLength={REOPEN_REASON_MAX}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Client asked for changes after delivery"
        />
      )}
    </FormField>
  );
}

/** Stand-alone dialog for places that change status without a form (a
 * dropdown in a table). */
export function ReopenReasonDialog({
  open,
  taskLabel,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  taskLabel: string;
  loading?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setReason("");
    setError(null);
    onCancel();
  };

  return (
    <Dialog open={open} onClose={close} size="md" title="Reopen completed task">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!reason.trim()) {
            setError("Enter a reason for reopening this task.");
            return;
          }
          onConfirm(reason.trim());
          setReason("");
          setError(null);
        }}
      >
        <p className="text-xs text-gray-500 dark:text-gray-400">{taskLabel}</p>
        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-400"
          >
            {error}
          </p>
        ) : null}
        <ReopenReasonField value={reason} onChange={setReason} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={loading === true}>
            Reopen task
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
