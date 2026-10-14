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
import { useDebouncedValue, useEmployees } from "@/features/hr/employees/hooks";
import { useCreateTask } from "../hooks";
import { createTaskSchema, EMPTY_CREATE_FORM } from "../schema";
import { PRIORITY_LABELS } from "../status";
import { TASK_PRIORITIES } from "../types";

export interface CreateTaskDialogProps {
  open: boolean;
  onClose: () => void;
}

function describeCreateError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isPermissionError) {
      return "You don't have permission to assign a task.";
    }
    if (error.errorCode === "INVALID_ASSIGNEE") {
      return "That employee is outside your scope or does not exist.";
    }
    if (error.errorCode === "DUE_DATE_IN_PAST") {
      return "Due date cannot be in the past.";
    }
    if (error.errorCode === "ASSIGNEE_HAS_LEFT") {
      return "That employee is no longer active.";
    }
    if (error.isValidationError) {
      return "The server rejected some values. Fix them and try again.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

const today = () => new Intl.DateTimeFormat("en-CA").format(new Date());

/** Assigns a new task to an employee in the caller's scope (hr.task.write). */
export function CreateTaskDialog({ open, onClose }: CreateTaskDialogProps) {
  const [values, setValues] = useState({
    ...EMPTY_CREATE_FORM,
    dueDate: today(),
  });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const debouncedSearch = useDebouncedValue(assigneeSearch);
  const employees = useEmployees({
    page: 1,
    limit: 100,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  });
  const mutation = useCreateTask();
  const { toast } = useToast();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = createTaskSchema.safeParse(values);
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
        assigneeId: Number(result.data.assigneeId),
        dueDate: result.data.dueDate,
        priority: result.data.priority,
      });
      toast({ title: "Task assigned", variant: "success" });
      setValues({ ...EMPTY_CREATE_FORM, dueDate: today() });
      setAssigneeSearch("");
      onClose();
    } catch (error) {
      setServerError(describeCreateError(error));
    }
  }

  const submitting = mutation.isPending;
  const employeeOptions = employees.data?.data ?? [];

  return (
    <Dialog open={open} onClose={onClose} title="New Task" size="lg">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4.5"
        noValidate
      >
        <div>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            Create a new task and assign it to an employee.
          </p>
        </div>

        {/* Task Title */}
        <FormField
          label="Task Title"
          required
          error={errors.title}
          hint="Up to 80 characters."
        >
          {(f) => (
            <Input
              {...f}
              placeholder="Enter task title..."
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

        {/* Assign To */}
        <FormField label="Assign To" required error={errors.assigneeId}>
          {(f) => (
            <div className="flex flex-col gap-2">
              <Select
                {...f}
                invalid={f.invalid}
                value={values.assigneeId}
                disabled={submitting}
                onChange={(e) =>
                  setValues((v) => ({ ...v, assigneeId: e.target.value }))
                }
              >
                <option value="">
                  {employees.isPending
                    ? "Loading employees…"
                    : "Select employee"}
                </option>
                {employeeOptions.map((emp) => (
                  <option key={emp.id} value={String(emp.id)}>
                    {emp.fullName} ({emp.employeeCode})
                  </option>
                ))}
              </Select>
            </div>
          )}
        </FormField>

        {/* Priority & Due Date (2-column layout) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Priority" required>
            {(f) => (
              <Select
                {...f}
                value={values.priority}
                disabled={submitting}
                onChange={(e) =>
                  setValues((v) => ({
                    ...v,
                    priority: e.target
                      .value as (typeof TASK_PRIORITIES)[number],
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

          <FormField label="Due Date" required error={errors.dueDate}>
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
        </div>

        {/* Description */}
        <FormField
          label="Description (Optional)"
          error={errors.description}
          labelAction={
            <span className="text-theme-xs text-gray-400 font-normal">
              {values.description?.length ?? 0}/500
            </span>
          }
        >
          {(f) => (
            <Textarea
              {...f}
              rows={3}
              placeholder="Enter task description..."
              invalid={f.invalid}
              value={values.description}
              disabled={submitting}
              maxLength={500}
              onChange={(e) =>
                setValues((v) => ({ ...v, description: e.target.value }))
              }
            />
          )}
        </FormField>

        {serverError ? (
          <Alert variant="error" title="Could not assign task">
            {serverError}
          </Alert>
        ) : null}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-800">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={submitting}
            aria-label="Assign task"
            className="bg-brand-500 hover:bg-brand-600 text-white font-medium"
          >
            Create Task
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
