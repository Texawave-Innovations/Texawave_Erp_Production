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
import { useCreateMyWorkLog } from "../hooks";
import { createWorkLogSchema, EMPTY_CREATE_FORM } from "../schema";

export interface CreateWorkLogDialogProps {
  open: boolean;
  onClose: () => void;
}

function describeCreateError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isPermissionError) {
      return "You don't have permission to submit a work log.";
    }
    if (error.isValidationError) {
      return "The server rejected some values. Fix them and try again.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

const today = () => new Intl.DateTimeFormat("en-CA").format(new Date());

/** Submits a work log for the authenticated user's own employee record. */
export function CreateWorkLogDialog({
  open,
  onClose,
}: CreateWorkLogDialogProps) {
  const [values, setValues] = useState({
    ...EMPTY_CREATE_FORM,
    workDate: today(),
  });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const mutation = useCreateMyWorkLog();
  const { toast } = useToast();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = createWorkLogSchema.safeParse(values);
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
        workDate: result.data.workDate,
        hoursWorked: Number(result.data.hoursWorked),
        taskDescription: result.data.taskDescription,
      });
      toast({ title: "Work log submitted", variant: "success" });
      setValues({ ...EMPTY_CREATE_FORM, workDate: today() });
      onClose();
    } catch (error) {
      setServerError(describeCreateError(error));
    }
  }

  const submitting = mutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} title="Submit a work log">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField label="Date" required error={errors.workDate}>
          {(f) => (
            <Input
              {...f}
              type="date"
              invalid={f.invalid}
              value={values.workDate}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({ ...v, workDate: e.target.value }))
              }
            />
          )}
        </FormField>
        <FormField
          label="Hours worked"
          required
          error={errors.hoursWorked}
          hint="Between 0.01 and 24, up to 2 decimals."
        >
          {(f) => (
            <Input
              {...f}
              type="number"
              step="0.01"
              min="0.01"
              max="24"
              invalid={f.invalid}
              value={values.hoursWorked}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({ ...v, hoursWorked: e.target.value }))
              }
            />
          )}
        </FormField>
        <FormField
          label="Task description"
          required
          error={errors.taskDescription}
          hint="3–500 characters."
        >
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              invalid={f.invalid}
              value={values.taskDescription}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({ ...v, taskDescription: e.target.value }))
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
