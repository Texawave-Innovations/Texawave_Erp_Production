"use client";

import { useEffect, useState } from "react";
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

/**
 * Raise Exit Request Modal.
 * Renders in a centered modal dialog with fixed dark translucent backdrop blur,
 * background scroll locking, keyboard Escape dismissal, and mobile-safe viewport constraints.
 */
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

  // Prevent background scrolling while the modal is open
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  // Support Escape key to close the modal
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

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
    <Dialog
      open={open}
      onClose={onClose}
      title="Raise exit request"
      className="w-[calc(100%-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900 animate-modal my-auto mx-auto"
    >
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[calc(100dvh-11rem)] flex-col gap-4 overflow-y-auto px-0.5 py-1"
        noValidate
      >
        <FormField label="Reason" required error={errors.reason}>
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              invalid={f.invalid}
              placeholder="State the primary reason for leaving..."
              value={values.reason}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({ ...v, reason: e.target.value }))
              }
              className="resize-none focus-visible:ring-2 focus-visible:ring-brand-500"
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
                className="focus-visible:ring-2 focus-visible:ring-brand-500"
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
                placeholder="e.g. 30"
                value={values.noticePeriodDays}
                disabled={submitting}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    noticePeriodDays: Number(e.target.value),
                  }))
                }
                className="focus-visible:ring-2 focus-visible:ring-brand-500"
              />
            )}
          </FormField>
        </div>

        <FormField
          label="Additional notes"
          error={errors.additionalNotes}
          hint="Optional. Handover notes, pending projects, or specific instructions."
        >
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              invalid={f.invalid}
              placeholder="Any additional details or handover notes (optional)"
              value={values.additionalNotes}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({ ...v, additionalNotes: e.target.value }))
              }
              className="resize-none focus-visible:ring-2 focus-visible:ring-brand-500"
            />
          )}
        </FormField>

        {serverError ? (
          <Alert variant="error" title="Could not submit">
            {serverError}
          </Alert>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
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
