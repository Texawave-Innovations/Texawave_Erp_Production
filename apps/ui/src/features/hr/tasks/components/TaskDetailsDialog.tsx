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
import { useEmployees } from "@/features/hr/employees/hooks";
import {
  useApproveTask,
  useReopenTask,
  useReassignTask,
  useSetTaskStatus,
} from "../hooks";
import { STATUS_LABELS } from "../status";
import { TASK_STATUSES, type TaskItem, type TaskStatus } from "../types";
import { TaskPriorityBadge, TaskStatusBadge } from "./TaskStatusBadge";

export interface TaskDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  task: TaskItem | null;
  canWrite?: boolean;
}

function describeStatusError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isPermissionError) {
      return "You don't have permission to modify this task.";
    }
    if (error.errorCode === "INVALID_STATE_TRANSITION") {
      return "This task can no longer move to that status — it may already be approved or locked.";
    }
  }
  return "Could not update task status. Please try again.";
}

function describeReassignError(error: unknown): string {
  if (error instanceof ApiError && error.isPermissionError) {
    return "You don't have permission to reassign this task.";
  }
  return "Could not reassign task. Please verify the assignee exists and try again.";
}

interface TaskDetailsFormProps {
  task: TaskItem;
  onClose: () => void;
  canWrite?: boolean;
}

function TaskDetailsForm({
  task,
  onClose,
  canWrite = false,
}: TaskDetailsFormProps) {
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus>(task.status);
  const [assigneeId, setAssigneeId] = useState<string>(
    String(task.assignee.id),
  );
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setStatus = useSetTaskStatus();
  const reassign = useReassignTask();
  const approve = useApproveTask();
  const reopen = useReopenTask();
  const { toast } = useToast();

  const employees = useEmployees({ page: 1, limit: 100 });
  const employeeOptions = employees.data?.data ?? [];

  const isReassignable =
    canWrite &&
    !task.isEmployeeCreated &&
    !task.adminApproved &&
    (task.status === "PENDING" || task.status === "IN_PROGRESS");

  const isStatusEditable =
    canWrite && !task.adminApproved && !task.awaitingApproval;

  async function handleUpdate(event: React.FormEvent) {
    event.preventDefault();
    setServerError(null);
    setSubmitting(true);

    try {
      let changed = false;

      // Handle Reassignment
      if (
        isReassignable &&
        assigneeId &&
        Number(assigneeId) !== task.assignee.id
      ) {
        await reassign.mutateAsync({
          id: task.id,
          assigneeId: Number(assigneeId),
        });
        changed = true;
      }

      // Handle Status Change
      if (isStatusEditable && selectedStatus !== task.status) {
        await setStatus.mutateAsync({
          id: task.id,
          status: selectedStatus,
        });
        changed = true;
      }

      if (changed) {
        toast({ title: "Task updated successfully", variant: "success" });
      }
      onClose();
    } catch (error) {
      const msg =
        selectedStatus !== task.status
          ? describeStatusError(error)
          : describeReassignError(error);
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove() {
    setServerError(null);
    setSubmitting(true);
    try {
      await approve.mutateAsync(task.id);
      toast({ title: "Task approved", variant: "success" });
      onClose();
    } catch {
      setServerError("Could not approve task.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReopen() {
    setServerError(null);
    setSubmitting(true);
    try {
      await reopen.mutateAsync(task.id);
      toast({ title: "Task reopened", variant: "success" });
      onClose();
    } catch {
      setServerError("Could not reopen task.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleUpdate} className="flex flex-col gap-4.5" noValidate>
      {/* Read-only Task Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
        <div>
          <span className="text-theme-xs text-gray-500 dark:text-gray-400 block">
            Priority
          </span>
          <div className="mt-1">
            <TaskPriorityBadge priority={task.priority} />
          </div>
        </div>
        <div>
          <span className="text-theme-xs text-gray-500 dark:text-gray-400 block">
            Current Status
          </span>
          <div className="mt-1">
            <TaskStatusBadge status={task.status} />
          </div>
        </div>
        {task.dueDate ? (
          <div>
            <span className="text-theme-xs text-gray-500 dark:text-gray-400 block">
              Due Date
            </span>
            <span className="text-theme-sm font-medium text-gray-900 dark:text-white/90">
              {task.dueDate}
            </span>
          </div>
        ) : null}
        <div>
          <span className="text-theme-xs text-gray-500 dark:text-gray-400 block">
            Created By
          </span>
          <span className="text-theme-sm font-medium text-gray-900 dark:text-white/90">
            {task.isEmployeeCreated ? "Employee Request" : "Admin / Lead"}
          </span>
        </div>
      </div>

      {/* Description */}
      {task.description ? (
        <FormField label="Description">
          {() => (
            <Textarea
              readOnly
              rows={3}
              value={task.description ?? ""}
              className="bg-gray-50 dark:bg-gray-800 cursor-default"
            />
          )}
        </FormField>
      ) : null}

      {/* Assignee Selection (Editable if permitted) */}
      <FormField
        label="Assigned To"
        hint={
          !isReassignable
            ? "Assignee cannot be changed in this status"
            : undefined
        }
      >
        {(fieldProps) =>
          isReassignable ? (
            <Select
              {...fieldProps}
              value={assigneeId}
              disabled={submitting}
              onChange={(e) => setAssigneeId(e.target.value)}
            >
              {employeeOptions.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.employeeCode})
                </option>
              ))}
            </Select>
          ) : (
            <Input
              {...fieldProps}
              readOnly
              disabled
              value={task.assignee.fullName}
              className="bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
            />
          )
        }
      </FormField>

      {/* Status Transition (Editable if permitted) */}
      <FormField
        label="Status"
        hint={
          !isStatusEditable ? "Status cannot be directly modified" : undefined
        }
      >
        {(fieldProps) =>
          isStatusEditable ? (
            <Select
              {...fieldProps}
              value={selectedStatus}
              disabled={submitting}
              onChange={(e) => setSelectedStatus(e.target.value as TaskStatus)}
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              {...fieldProps}
              readOnly
              disabled
              value={STATUS_LABELS[task.status]}
              className="bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
            />
          )
        }
      </FormField>

      {/* Awaiting Review Banner for Admins */}
      {canWrite && task.awaitingApproval ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-warning-200 bg-warning-50/60 dark:border-warning-900/60 dark:bg-warning-950/30">
          <div>
            <p className="text-theme-sm font-medium text-warning-900 dark:text-warning-200">
              This task has been marked Done and awaits review.
            </p>
            <p className="text-theme-xs text-warning-700 dark:text-warning-400">
              Approve to finalize, or reopen to send back to In Progress.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={submitting}
              onClick={handleReopen}
            >
              Reopen
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={submitting}
              onClick={handleApprove}
            >
              Approve
            </Button>
          </div>
        </div>
      ) : null}

      {serverError ? (
        <Alert variant="error" title="Could not update task">
          {serverError}
        </Alert>
      ) : null}

      {/* Footer Actions */}
      <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-800">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </Button>
        {isStatusEditable || isReassignable ? (
          <Button type="submit" loading={submitting}>
            Update Task
          </Button>
        ) : (
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        )}
      </div>
    </form>
  );
}

export function TaskDetailsDialog({
  open,
  onClose,
  task,
  canWrite = false,
}: TaskDetailsDialogProps) {
  if (!task) return null;

  return (
    <Dialog open={open} onClose={onClose} title={task.title} size="lg">
      <TaskDetailsForm
        key={task.id}
        task={task}
        onClose={onClose}
        canWrite={canWrite}
      />
    </Dialog>
  );
}
