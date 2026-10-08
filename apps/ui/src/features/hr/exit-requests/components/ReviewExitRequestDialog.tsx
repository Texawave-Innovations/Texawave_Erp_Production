"use client";

import { useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
  Select,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useUpdateExitRequest } from "../hooks";
import { decideExitRequestSchema } from "../schema";
import { SETTLEMENT_LABELS, STATUS_LABELS } from "../status";
import {
  SETTLEMENT_STATUSES,
  TRANSITIONS,
  type ExitRequestItem,
  type ExitRequestStatus,
} from "../types";

export interface ReviewExitRequestDialogProps {
  open: boolean;
  onClose: () => void;
  request: ExitRequestItem;
}

function describeReviewError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.errorCode === "SELF_DECISION_FORBIDDEN") {
      return "You cannot decide your own exit request.";
    }
    if (error.errorCode === "DECISION_SCOPE_REQUIRED") {
      return "Deciding an exit request requires team or organization scope.";
    }
    if (error.isPermissionError) {
      return "You don't have permission to review this exit request.";
    }
    if (error.statusCode === 404) {
      return "This exit request is no longer in your scope.";
    }
    if (error.errorCode === "INVALID_STATE_TRANSITION") {
      return "This status change is no longer allowed for the request's current state.";
    }
    if (error.errorCode === "NO_CHANGES") {
      return "Change at least one field before saving.";
    }
    if (error.isValidationError) {
      return "The server rejected some values. Check the fields and try again.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

/** Review/decide an exit request: move it along the transition map and/or
 * edit the confirmed last working date, settlement status and HR note.
 * REJECTED and COMPLETED are final — no further change is offered then.
 * Maker-checker and scope are enforced server-side (403
 * SELF_DECISION_FORBIDDEN / DECISION_SCOPE_REQUIRED), never by this dialog. */
export function ReviewExitRequestDialog({
  open,
  onClose,
  request,
}: ReviewExitRequestDialogProps) {
  const nextStatuses = TRANSITIONS[request.status];
  const [status, setStatus] = useState<"" | ExitRequestStatus>("");
  const [confirmedLastWorkingDate, setConfirmedLastWorkingDate] = useState(
    request.confirmedLastWorkingDate ?? "",
  );
  const [settlementStatus, setSettlementStatus] = useState(
    request.settlementStatus ?? "",
  );
  const [hrNote, setHrNote] = useState(request.hrNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const update = useUpdateExitRequest();
  const { toast } = useToast();

  const submitting = update.isPending;
  const isTerminal = nextStatuses.length === 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = decideExitRequestSchema.safeParse({
      confirmedLastWorkingDate,
      settlementStatus,
      hrNote,
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid value");
      return;
    }
    setError(null);
    setServerError(null);
    try {
      await update.mutateAsync({
        id: request.id,
        body: {
          ...(status ? { status } : {}),
          ...(result.data.confirmedLastWorkingDate
            ? { confirmedLastWorkingDate: result.data.confirmedLastWorkingDate }
            : {}),
          ...(result.data.settlementStatus
            ? { settlementStatus: result.data.settlementStatus }
            : {}),
          ...(result.data.hrNote !== (request.hrNote ?? "")
            ? { hrNote: result.data.hrNote }
            : {}),
        },
      });
      toast({ title: "Exit request updated", variant: "success" });
      onClose();
    } catch (err) {
      setServerError(describeReviewError(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Review exit request">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1 rounded-lg bg-gray-50 p-3 text-theme-sm dark:bg-gray-800">
          <p className="font-medium text-gray-900 dark:text-white/90">
            {request.employee.fullName}
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Preferred last working date: {request.preferredLastWorkingDate} ·
            Notice: {request.noticePeriodDays} day(s)
          </p>
          <p className="text-gray-600 dark:text-gray-400">{request.reason}</p>
        </div>

        {isTerminal ? (
          <Alert variant="info" title={STATUS_LABELS[request.status]}>
            This request is in a final state and can no longer change status.
          </Alert>
        ) : (
          <FormField
            label="Move to status"
            hint="Optional. Leave unset to edit only the fields below."
          >
            {(f) => (
              <Select
                {...f}
                value={status}
                disabled={submitting}
                onChange={(e) =>
                  setStatus(e.target.value as "" | ExitRequestStatus)
                }
              >
                <option value="">No status change</option>
                {nextStatuses.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Confirmed last working date">
            {(f) => (
              <Input
                {...f}
                type="date"
                value={confirmedLastWorkingDate}
                disabled={submitting}
                onChange={(e) => setConfirmedLastWorkingDate(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Settlement status">
            {(f) => (
              <Select
                {...f}
                value={settlementStatus}
                disabled={submitting}
                onChange={(e) => setSettlementStatus(e.target.value)}
              >
                <option value="">Not set</option>
                {SETTLEMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {SETTLEMENT_LABELS[s]}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </div>
        <FormField
          label="HR note"
          hint="Shown to the employee. Up to 2000 characters."
          error={error ?? undefined}
        >
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              invalid={f.invalid}
              value={hrNote}
              disabled={submitting}
              onChange={(e) => setHrNote(e.target.value)}
            />
          )}
        </FormField>
        {serverError ? (
          <Alert variant="error" title="Could not save">
            {serverError}
          </Alert>
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
          <Button type="submit" loading={submitting}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
