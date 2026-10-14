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
  useToast,
} from "@texawave-erp/ui-kit";
import { useDebouncedValue, useEmployees } from "@/features/hr/employees/hooks";
import { useReassignTask } from "../hooks";
import { reassignTaskSchema } from "../schema";
import type { TaskItem } from "../types";

export interface ReassignTaskDialogProps {
  open: boolean;
  onClose: () => void;
  task: Pick<TaskItem, "id" | "title" | "assignee">;
}

function describeReassignError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isPermissionError) {
      return "You don't have permission to reassign this task.";
    }
    if (error.errorCode === "INVALID_ASSIGNEE") {
      return "That employee is outside your scope or does not exist.";
    }
    if (error.errorCode === "TASK_NOT_REASSIGNABLE") {
      return "Only a pending or in-progress task can be reassigned.";
    }
    if (error.errorCode === "EMPLOYEE_CREATED_TASK_NOT_REASSIGNABLE") {
      return "An employee-created task cannot be reassigned.";
    }
    if (error.statusCode === 404) {
      return "This task is no longer in your scope.";
    }
    return error.message;
  }
  return "Something went wrong. Try again.";
}

/** Reassigns an open, admin-assigned task to another employee in scope. */
export function ReassignTaskDialog({
  open,
  onClose,
  task,
}: ReassignTaskDialogProps) {
  const [assigneeId, setAssigneeId] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const employees = useEmployees({
    page: 1,
    limit: 20,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  });
  const mutation = useReassignTask();
  const { toast } = useToast();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = reassignTaskSchema.safeParse({ assigneeId });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid assignee");
      return;
    }
    setError(null);
    setServerError(null);
    try {
      await mutation.mutateAsync({
        id: task.id,
        assigneeId: Number(result.data.assigneeId),
      });
      toast({ title: "Task reassigned", variant: "success" });
      setAssigneeId("");
      onClose();
    } catch (err) {
      setServerError(describeReassignError(err));
    }
  }

  const submitting = mutation.isPending;
  const employeeOptions = (employees.data?.data ?? []).filter(
    (emp) => emp.id !== task.assignee.id,
  );

  return (
    <Dialog open={open} onClose={onClose} title="Reassign task">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <p className="text-theme-sm text-gray-600 dark:text-gray-400">
          "{task.title}" is currently assigned to {task.assignee.fullName}.
        </p>
        <FormField label="New assignee" required error={error ?? undefined}>
          {(f) => (
            <div className="flex flex-col gap-2">
              <Input
                placeholder="Search employees"
                value={search}
                disabled={submitting}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select
                {...f}
                invalid={f.invalid}
                value={assigneeId}
                disabled={submitting}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">
                  {employees.isPending ? "Loading…" : "Select an employee"}
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
        {serverError ? (
          <Alert variant="error" title="Could not reassign">
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
            Reassign
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
