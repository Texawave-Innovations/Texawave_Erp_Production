"use client";

import { useState } from "react";
import { ApiError } from "@texawave-erp/core";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  FormField,
  Input,
  Select,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useCreateMyTask } from "../hooks";
import { createMyTaskSchema, EMPTY_CREATE_MY_TASK_FORM } from "../schema";
import { PRIORITY_LABELS } from "../status";
import { TASK_PRIORITIES } from "../types";

export interface CreateMyTaskDialogProps {
  open: boolean;
  onClose: () => void;
}

function describeCreateError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isPermissionError) {
      return "You don't have permission to create a task.";
    }
    if (error.errorCode === "DUE_DATE_IN_PAST") {
      return "Due date cannot be in the past.";
    }
    if (error.errorCode === "NOT_AN_ACTIVE_EMPLOYEE") {
      return "Your employee record is not active.";
    }
    if (error.isValidationError) {
      return "The server rejected some values. Fix them and try again.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

const today = () => new Intl.DateTimeFormat("en-CA").format(new Date());

/** Creates a task for the authenticated employee's own record (legacy
 * `MyTasks.tsx` "New Task"), optionally flagging it for admin/HR attention. */
export function CreateMyTaskDialog({ open, onClose }: CreateMyTaskDialogProps) {
  const [values, setValues] = useState({
    ...EMPTY_CREATE_MY_TASK_FORM,
    dueDate: today(),
  });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const mutation = useCreateMyTask();
  const { toast } = useToast();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = createMyTaskSchema.safeParse(values);
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
        title: result.data.title,
        ...(result.data.description
          ? { description: result.data.description }
          : {}),
        dueDate: result.data.dueDate,
        priority: result.data.priority,
        requestToAdmin: result.data.requestToAdmin,
      });
      toast({
        title: result.data.requestToAdmin
          ? "Task sent to admin/HR"
          : "Task created",
        variant: "success",
      });
      setValues({ ...EMPTY_CREATE_MY_TASK_FORM, dueDate: today() });
      onClose();
    } catch (error) {
      setServerError(describeCreateError(error));
    }
  }

  const submitting = mutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} title="New task">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField
          label="Title"
          required
          error={errors.title}
          hint="Up to 80 characters."
        >
          {(f) => (
            <Input
              {...f}
              invalid={f.invalid}
              value={values.title}
              disabled={submitting}
              maxLength={80}
              onChange={(e) =>
                setValues((v) => ({ ...v, title: e.target.value }))
              }
            />
          )}
        </FormField>
        <FormField label="Priority" required>
          {(f) => (
            <Select
              {...f}
              value={values.priority}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({
                  ...v,
                  priority: e.target.value as (typeof TASK_PRIORITIES)[number],
                }))
              }
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Due date" required error={errors.dueDate}>
          {(f) => (
            <Input
              {...f}
              type="date"
              invalid={f.invalid}
              value={values.dueDate}
              min={today()}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({ ...v, dueDate: e.target.value }))
              }
            />
          )}
        </FormField>
        <FormField
          label="Description"
          error={errors.description}
          hint="Optional, up to 500 characters."
        >
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              invalid={f.invalid}
              value={values.description}
              disabled={submitting}
              onChange={(e) =>
                setValues((v) => ({ ...v, description: e.target.value }))
              }
            />
          )}
        </FormField>
        <label className="flex items-start gap-2 text-theme-sm text-gray-700 dark:text-gray-300">
          <Checkbox
            checked={values.requestToAdmin}
            disabled={submitting}
            onChange={(e) =>
              setValues((v) => ({ ...v, requestToAdmin: e.target.checked }))
            }
          />
          <span>
            Request admin/HR attention
            <span className="block text-theme-xs text-gray-500 dark:text-gray-400">
              Lists this task for Admin/HR to review.
            </span>
          </span>
        </label>
        {serverError ? (
          <Alert variant="error" title="Could not create task">
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
            {values.requestToAdmin ? "Send to admin" : "Create task"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
