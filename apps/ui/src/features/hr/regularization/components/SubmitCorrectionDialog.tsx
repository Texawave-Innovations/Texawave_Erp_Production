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
import { useSubmitCorrection } from "../hooks";
import {
  EMPTY_SUBMIT_FORM,
  submitCorrectionSchema,
  validateCorrectionTimes,
} from "../schema";
import { CORRECTION_TYPE_LABELS } from "../status";
import { ALLOWED_TIMES, CORRECTION_TYPES } from "../types";

export interface SubmitCorrectionDialogProps {
  open: boolean;
  onClose: () => void;
}

function describeSubmitError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isPermissionError) {
      return "You don't have permission to request an attendance correction.";
    }
    if (error.errorCode === "CORRECTION_ALREADY_REQUESTED") {
      return "A correction has already been requested for this date.";
    }
    if (
      error.errorCode === "CORRECTION_TIME_REQUIRED" ||
      error.errorCode === "CORRECTION_FIELD_NOT_ALLOWED" ||
      error.errorCode === "PUNCH_OUTSIDE_DATE" ||
      error.errorCode === "CHECK_OUT_BEFORE_CHECK_IN" ||
      error.errorCode === "FUTURE_DATE"
    ) {
      return error.message;
    }
    if (error.isValidationError) {
      return "The server rejected some values. Fix them and try again.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

/** Converts a datetime-local value (local time, no zone) to an ISO instant. */
function toIso(local: string): string {
  return new Date(local).toISOString();
}

const today = () => new Intl.DateTimeFormat("en-CA").format(new Date());

/** Submits an attendance correction for the authenticated user's own
 * employee record. There is deliberately no employee picker. */
export function SubmitCorrectionDialog({
  open,
  onClose,
}: SubmitCorrectionDialogProps) {
  const [values, setValues] = useState({
    ...EMPTY_SUBMIT_FORM,
    attendanceDate: today(),
  });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const mutation = useSubmitCorrection();
  const { toast } = useToast();

  const allowed = ALLOWED_TIMES[values.correctionType];

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = submitCorrectionSchema.safeParse(values);
    if (!result.success) {
      const next: Partial<Record<string, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    const timeError = validateCorrectionTimes(result.data);
    if (timeError) {
      setErrors({ requestedCheckInAt: timeError });
      return;
    }
    setErrors({});
    setServerError(null);
    try {
      await mutation.mutateAsync({
        attendanceDate: result.data.attendanceDate,
        correctionType: result.data.correctionType,
        reason: result.data.reason,
        ...(result.data.requestedCheckInAt
          ? { requestedCheckInAt: toIso(result.data.requestedCheckInAt) }
          : {}),
        ...(result.data.requestedCheckOutAt
          ? { requestedCheckOutAt: toIso(result.data.requestedCheckOutAt) }
          : {}),
      });
      toast({ title: "Correction requested", variant: "success" });
      setValues({ ...EMPTY_SUBMIT_FORM, attendanceDate: today() });
      onClose();
    } catch (error) {
      setServerError(describeSubmitError(error));
    }
  }

  const submitting = mutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} title="Request a correction">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField
          label="Attendance date"
          required
          error={errors.attendanceDate}
        >
          {(f) => (
            <Input
              {...f}
              type="date"
              invalid={f.invalid}
              value={values.attendanceDate}
              disabled={submitting}
              max={today()}
              onChange={(e) =>
                setValues((v) => ({ ...v, attendanceDate: e.target.value }))
              }
            />
          )}
        </FormField>
        <FormField
          label="Correction type"
          required
          error={errors.correctionType}
        >
          {(f) => (
            <Select
              {...f}
              value={values.correctionType}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  correctionType: e.target.value as typeof v.correctionType,
                }))
              }
            >
              {CORRECTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CORRECTION_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        {allowed.in ? (
          <FormField
            label="Corrected check-in"
            hint="Local date and time."
            error={errors.requestedCheckInAt}
          >
            {(f) => (
              <Input
                {...f}
                type="datetime-local"
                invalid={f.invalid}
                value={values.requestedCheckInAt}
                disabled={submitting}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    requestedCheckInAt: e.target.value,
                  }))
                }
              />
            )}
          </FormField>
        ) : null}
        {allowed.out ? (
          <FormField label="Corrected check-out" hint="Local date and time.">
            {(f) => (
              <Input
                {...f}
                type="datetime-local"
                invalid={f.invalid}
                value={values.requestedCheckOutAt}
                disabled={submitting}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    requestedCheckOutAt: e.target.value,
                  }))
                }
              />
            )}
          </FormField>
        ) : null}
        <FormField
          label="Reason"
          required
          error={errors.reason}
          hint="3–500 characters. Visible to whoever decides the request."
        >
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
