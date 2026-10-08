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
import { useSubmitAttendanceCorrection } from "../hooks";
import {
  CORRECTION_FIELD_RULES,
  EMPTY_SUBMIT_CORRECTION_FORM,
  submitCorrectionSchema,
} from "../schema";
import { CORRECTION_TYPE_LABELS } from "../status";
import { CORRECTION_TYPES, type CorrectionType } from "../types";

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
    if (error.errorCode === "FUTURE_DATE") {
      return "A correction cannot be requested for a future date.";
    }
    if (error.errorCode === "PUNCH_OUTSIDE_DATE") {
      return "The requested time must fall on the attendance date.";
    }
    if (error.errorCode === "CHECK_OUT_BEFORE_CHECK_IN") {
      return "The requested check-out must be after the check-in.";
    }
    if (error.isValidationError) {
      return "The server rejected some values. Fix them and try again.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

/** Converts a datetime-local value (local time, no zone) to an ISO instant. */
function toIso(local: string): string | undefined {
  if (!local) return undefined;
  return new Date(local).toISOString();
}

/** Employee self-service: request a correction to one's own attendance for a
 * past day (legacy Regularization, `ATTENDANCE_LEGACY_PARITY.md` §5.2). There
 * is deliberately no employee field — the server resolves it from the JWT. */
export function SubmitCorrectionDialog({
  open,
  onClose,
}: SubmitCorrectionDialogProps) {
  const [values, setValues] = useState(EMPTY_SUBMIT_CORRECTION_FORM);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const mutation = useSubmitAttendanceCorrection();
  const { toast } = useToast();
  const submitting = mutation.isPending;

  const rules = CORRECTION_FIELD_RULES[values.correctionType];

  function updateType(correctionType: CorrectionType) {
    setValues((v) => ({
      ...v,
      correctionType,
      requestedCheckInAt: CORRECTION_FIELD_RULES[correctionType].in
        ? v.requestedCheckInAt
        : "",
      requestedCheckOutAt: CORRECTION_FIELD_RULES[correctionType].out
        ? v.requestedCheckOutAt
        : "",
    }));
  }

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
    setErrors({});
    setServerError(null);
    try {
      const checkInIso = toIso(result.data.requestedCheckInAt);
      const checkOutIso = toIso(result.data.requestedCheckOutAt);
      await mutation.mutateAsync({
        attendanceDate: result.data.attendanceDate,
        correctionType: result.data.correctionType,
        ...(checkInIso ? { requestedCheckInAt: checkInIso } : {}),
        ...(checkOutIso ? { requestedCheckOutAt: checkOutIso } : {}),
        reason: result.data.reason,
      });
      toast({ title: "Correction submitted", variant: "success" });
      setValues(EMPTY_SUBMIT_CORRECTION_FORM);
      onClose();
    } catch (error) {
      setServerError(describeSubmitError(error));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Request a correction">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField label="Date" required error={errors.attendanceDate}>
          {(f) => (
            <Input
              {...f}
              type="date"
              invalid={f.invalid}
              value={values.attendanceDate}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({ ...v, attendanceDate: e.target.value }))
              }
            />
          )}
        </FormField>

        <FormField label="Type" required>
          {(f) => (
            <Select
              {...f}
              value={values.correctionType}
              disabled={submitting}
              onChange={(e) => updateType(e.target.value as CorrectionType)}
            >
              {CORRECTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CORRECTION_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        {rules.in ? (
          <FormField
            label="Corrected check-in"
            required={Boolean(rules.requiresIn)}
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

        {rules.out ? (
          <FormField
            label="Corrected check-out"
            required={Boolean(rules.requiresOut)}
            error={errors.requestedCheckOutAt}
          >
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
