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
import { useCreateMyLeaveRequest, useMyLeaveBalances } from "../hooks";
import { EMPTY_REQUEST_FORM, requestLeaveSchema } from "../schema";
import { DAY_PORTION_LABELS } from "../status";
import { DAY_PORTIONS } from "../types";

export interface RequestLeaveDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Maps the backend error codes in Docs/HR_LEAVE.md §2-5 to a clear message. */
function describeSubmitError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isPermissionError) {
      return "You don't have permission to request leave.";
    }
    switch (error.errorCode) {
      case "LEAVE_NO_WORKING_DAYS":
        return "This range has no working day — it falls entirely on holidays or weekly offs.";
      case "LEAVE_SPANS_YEAR":
        return "A leave request cannot span two calendar years. Split it into two requests.";
      case "LEAVE_BALANCE_INSUFFICIENT":
        return "This request exceeds your available balance for this leave type.";
      case "INVALID_STATE_TRANSITION":
        return "This request can no longer be changed.";
      default:
        break;
    }
    if (error.isValidationError) {
      return "The server rejected some values. Check the dates and reason and try again.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

/** Submits leave for the authenticated user's own employee. There is
 * deliberately no employee picker (Docs/HR_LEAVE.md — no employeeId in the
 * self-service create DTO). Leave type options come from the balances call
 * so only active types the employee can actually see are offered. */
export function RequestLeaveDialog({ open, onClose }: RequestLeaveDialogProps) {
  const [values, setValues] = useState(EMPTY_REQUEST_FORM);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const balances = useMyLeaveBalances();
  const mutation = useCreateMyLeaveRequest();
  const { toast } = useToast();

  const submitting = mutation.isPending;
  const types = balances.data ?? [];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = requestLeaveSchema.safeParse(values);
    if (!result.success) {
      const next: Partial<Record<string, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setServerError(null);
    try {
      await mutation.mutateAsync(result.data);
      toast({ title: "Leave requested", variant: "success" });
      setValues(EMPTY_REQUEST_FORM);
      onClose();
    } catch (err) {
      setServerError(describeSubmitError(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Request leave" size="xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {!balances.isPending && types.length === 0 ? (
          <Alert variant="warning" title="No active leave types configured">
            No active leave types are available. Ask HR or an administrator to
            set up leave types and entitlements before requesting leave.
          </Alert>
        ) : null}

        <FormField label="Leave type" required error={errors.leaveTypeId}>
          {(f) => (
            <Select
              {...f}
              value={values.leaveTypeId || ""}
              disabled={submitting || balances.isPending}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  leaveTypeId: Number(e.target.value),
                }))
              }
            >
              <option value="">Select a leave type</option>
              {types.map((t) => (
                <option key={t.leaveTypeId} value={t.leaveTypeId}>
                  {t.name}
                  {t.isPaid && t.available !== null
                    ? ` (${t.available} days available)`
                    : t.isPaid
                      ? ""
                      : " (unpaid)"}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Start date" required error={errors.startDate}>
            {(f) => (
              <Input
                {...f}
                type="date"
                invalid={f.invalid}
                value={values.startDate}
                disabled={submitting}
                onChange={(e) =>
                  setValues((v) => ({ ...v, startDate: e.target.value }))
                }
              />
            )}
          </FormField>
          <FormField label="End date" required error={errors.endDate}>
            {(f) => (
              <Input
                {...f}
                type="date"
                invalid={f.invalid}
                value={values.endDate}
                disabled={submitting}
                onChange={(e) =>
                  setValues((v) => ({ ...v, endDate: e.target.value }))
                }
              />
            )}
          </FormField>
        </div>

        <FormField
          label="Portion"
          error={errors.dayPortion}
          hint="A half-day must use the same start and end date."
        >
          {(f) => (
            <Select
              {...f}
              value={values.dayPortion}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  dayPortion: e.target.value as typeof v.dayPortion,
                }))
              }
            >
              {DAY_PORTIONS.map((p) => (
                <option key={p} value={p}>
                  {DAY_PORTION_LABELS[p]}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField
          label="Reason"
          required
          error={errors.reason}
          hint="3–500 characters. Visible to whoever reads or decides the request."
          labelAction={
            <span className="text-theme-xs font-mono text-gray-400 dark:text-gray-500">
              {values.reason.length}/500
            </span>
          }
        >
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              invalid={f.invalid}
              value={values.reason}
              disabled={submitting}
              placeholder="State the purpose of your leave..."
              onChange={(e) =>
                setValues((v) => ({ ...v, reason: e.target.value }))
              }
            />
          )}
        </FormField>

        {serverError ? (
          <Alert variant="error" title="Could not submit">
            {serverError}
          </Alert>
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
          <Button type="submit" loading={submitting}>
            Submit
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
