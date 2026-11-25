"use client";

import { useState } from "react";
import { Button, FormField, Input, Textarea } from "@texawave-erp/ui-kit";
import { useNotify } from "@/hooks/useNotify";
import { useCorrectSession, useReopenDay } from "../hooks";

const NOTE_MAX = 500;

/** HR sends an approved day back to the employee. A reason is required: the
 * employee sees it, fixes the day and submits it again. */
export function ReopenPanel({
  employeeId,
  date,
  onDone,
}: {
  employeeId: number;
  date: string;
  onDone: () => void;
}) {
  const reopen = useReopenDay();
  const { notify, notifyError } = useNotify();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Reopen this day
        </Button>
      </div>
    );
  }

  async function submit() {
    try {
      await reopen.mutateAsync({ employeeId, date, note: note.trim() });
      notify("timesheets.review.reopened");
      onDone();
    } catch (err) {
      notifyError(err, "timesheets.review.reopenFailed");
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
      <FormField
        label="Reason for reopening"
        required
        hint="The employee sees this, fixes the day and submits it again; it then goes through approval from the start."
      >
        {(field) => (
          <Textarea
            {...field}
            rows={2}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
      </FormField>
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            setOpen(false);
            setNote("");
          }}
          disabled={reopen.isPending}
        >
          Back
        </Button>
        <Button
          onClick={() => void submit()}
          loading={reopen.isPending}
          disabled={note.trim() === ""}
        >
          Reopen day
        </Button>
      </div>
    </div>
  );
}

/** HR confirms the real end of a timer that was closed with no time counted
 * (or flagged for review). Works on submitted and approved days; recorded in
 * the audit log with the reason. */
export function SessionFix({
  sessionId,
  onDone,
}: {
  sessionId: number;
  onDone: () => void;
}) {
  const correct = useCorrectSession();
  const { notify, notifyError } = useNotify();
  const [open, setOpen] = useState(false);
  const [endTime, setEndTime] = useState("");
  const [reason, setReason] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-cyan-300"
      >
        Set the real end time
      </button>
    );
  }

  async function submit() {
    try {
      const result = await correct.mutateAsync({
        sessionId,
        endTime,
        reason: reason.trim(),
      });
      notify("timesheets.review.timerCorrected", { minutes: result.minutes });
      onDone();
    } catch (err) {
      notifyError(err, "timesheets.review.timerCorrectFailed");
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
      <FormField
        label="Real end time (IST)"
        required
        hint="On the same day as the timer's start, not in the future."
      >
        {(field) => (
          <Input
            {...field}
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        )}
      </FormField>
      <FormField label="Reason" required>
        {(field) => (
          <Textarea
            {...field}
            rows={2}
            maxLength={NOTE_MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Employee confirmed they stopped at 5:30 pm"
          />
        )}
      </FormField>
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setOpen(false)}
          disabled={correct.isPending}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => void submit()}
          loading={correct.isPending}
          disabled={endTime === "" || reason.trim().length < 3}
        >
          Save end time
        </Button>
      </div>
    </div>
  );
}
