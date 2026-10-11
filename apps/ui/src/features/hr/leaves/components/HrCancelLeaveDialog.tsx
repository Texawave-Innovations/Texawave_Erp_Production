"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { leaveErrorMessage } from "../errors";
import { useHrCancelLeave } from "../hooks";
import { rejectLeaveSchema } from "../schema";
import type { LeaveRequestItem } from "../types";

export interface HrCancelLeaveDialogProps {
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
    | "status"
  >;
}

const todayStr = () => new Intl.DateTimeFormat("en-CA").format(new Date());

/**
 * HR cancels someone's pending or approved leave
 * (POST /hr/leave-requests/:id/cancel, `hr.leave.cancel`). An approved leave
 * may be cancelled even after it started; the reason is mandatory and is
 * shown to the employee (Docs/HR_LEAVE.md §6.4).
 */
export function HrCancelLeaveDialog({
  open,
  onClose,
  request,
}: HrCancelLeaveDialogProps) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const mutation = useHrCancelLeave();
  const { toast } = useToast();
  const started =
    request.status === "APPROVED" && request.startDate <= todayStr();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = rejectLeaveSchema.safeParse({ note });
    if (!result.success) {
      setError("A reason is required (3–500 characters)");
      return;
    }
    setError(null);
    setServerError(null);
    try {
      await mutation.mutateAsync({ id: request.id, note: result.data.note });
      toast({ title: "Leave cancelled", variant: "success" });
      onClose();
    } catch (err) {
      setServerError(
        leaveErrorMessage(
          err,
          "You don't have permission to cancel this leave.",
        ),
      );
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Cancel leave">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <p className="text-theme-sm text-gray-700 dark:text-gray-300">
          <strong>{request.employee.fullName}</strong> (
          {request.employee.employeeCode}) · {request.leaveType.name} ·{" "}
          {request.startDate}
          {request.endDate !== request.startDate
            ? ` – ${request.endDate}`
            : ""}{" "}
          · {request.leaveDays} day{request.leaveDays === 1 ? "" : "s"}
        </p>
        {started ? (
          <Alert variant="warning" title="This leave has already started">
            The whole request is cancelled: the days already passed lose their
            On leave status in attendance, and the balance is given back.
          </Alert>
        ) : null}
        <FormField
          label="Reason"
          required
          hint="Shown to the employee. 3–500 characters."
          error={error ?? undefined}
        >
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              invalid={f.invalid}
              value={note}
              disabled={mutation.isPending}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </FormField>
        {serverError ? (
          <Alert variant="error" title="Could not cancel">
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
            Keep leave
          </Button>
          <Button
            type="submit"
            variant="destructive"
            loading={mutation.isPending}
          >
            Cancel leave
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
