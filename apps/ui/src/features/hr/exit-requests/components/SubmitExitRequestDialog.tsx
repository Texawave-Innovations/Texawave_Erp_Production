"use client";

import { useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useCreateMyExitRequest } from "../hooks";
import { EMPTY_SUBMIT_FORM, submitExitRequestSchema } from "../schema";

export interface SubmitExitRequestDialogProps {
  open: boolean;
  onClose: () => void;
}

function describeSubmitError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.errorCode === "ACTIVE_EXIT_REQUEST_EXISTS") {
      return "You already have an active exit request. Only one is allowed at a time.";
    }
    if (error.errorCode === "PAST_LAST_WORKING_DATE") {
      return "The preferred last working date cannot be in the past.";
    }
    if (error.isPermissionError) {
      return "You don't have permission to submit an exit request.";
    }
    if (error.isValidationError) {
      return "The server rejected some values. Check the fields and try again.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

/** Submits an exit request for the authenticated user's own employee. There
 * is deliberately no employee picker (no `employeeId` in the self-service
 * create DTO) — resolved from the JWT. */
export function SubmitExitRequestDialog({
  open,
  onClose,
}: SubmitExitRequestDialogProps) {
  const [values, setValues] = useState(EMPTY_SUBMIT_FORM);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const mutation = useCreateMyExitRequest();
  const { toast } = useToast();

  const submitting = mutation.isPending;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = submitExitRequestSchema.safeParse(values);
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
      await mutation.mutateAsync({
        reason: result.data.reason,
        preferredLastWorkingDate: result.data.preferredLastWorkingDate,
        noticePeriodDays: result.data.noticePeriodDays,
        ...(result.data.additionalNotes
          ? { additionalNotes: result.data.additionalNotes }
          : {}),
      });
      toast({ title: "Exit request submitted", variant: "success" });
      setValues(EMPTY_SUBMIT_FORM);
      onClose();
    } catch (err) {
      setServerError(describeSubmitError(err));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Raise exit request">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField label="Reason" required error={errors.reason}>
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              invalid={f.invalid}
              value={values.reason}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({ ...v, reason: e.target.value }))
              }
            />
          )}
        </FormField>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField
            label="Preferred last working date"
            required
            error={errors.preferredLastWorkingDate}
          >
            {(f) => (
              <Input
                {...f}
                type="date"
                invalid={f.invalid}
                value={values.preferredLastWorkingDate}
                disabled={submitting}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    preferredLastWorkingDate: e.target.value,
                  }))
                }
              />
            )}
          </FormField>
          <FormField
            label="Notice period (days)"
            required
            error={errors.noticePeriodDays}
          >
            {(f) => (
              <Input
                {...f}
                type="number"
                min="0"
                invalid={f.invalid}
                value={values.noticePeriodDays}
                disabled={submitting}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    noticePeriodDays: Number(e.target.value),
                  }))
                }
              />
            )}
          </FormField>
        </div>
        <FormField
          label="Additional notes"
          error={errors.additionalNotes}
          hint="Optional. Handover notes, pending work."
        >
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              invalid={f.invalid}
              value={values.additionalNotes}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({ ...v, additionalNotes: e.target.value }))
              }
            />
          )}
        </FormField>
        {serverError ? (
          <Alert variant="error" title="Could not submit">
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
            Submit
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
