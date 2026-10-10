"use client";

import {
  Alert,
  Button,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  Select,
  Skeleton,
  StatusBadge,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { ApiError } from "@texawave-erp/core";
import { useState } from "react";
import { useCreateMyTask, useMyTasks, useUpdateMyTaskStatus } from "../hooks";
import { TASK_STATUSES, type MyTask } from "../api";

const STATUS_TOKEN: Record<string, "success" | "warning" | "gray"> = {
  DONE: "success",
  IN_PROGRESS: "warning",
  PENDING: "gray",
};

function NewTaskForm({ onClose }: { onClose: () => void }) {
  const createMutation = useCreateMyTask();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createMutation.mutateAsync({
        title,
        description: description || undefined,
        dueDate,
      });
      toast({ title: "Task created", variant: "success" });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not create this task. Check the fields and try again.",
      );
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="flex flex-col gap-4"
    >
      <FormField label="Title" required>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={80}
          />
        )}
      </FormField>
      <FormField label="Description">
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />
        )}
      </FormField>
      <FormField label="Due date" required>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        )}
      </FormField>
      {error ? (
        <p className="text-theme-xs text-error-600 dark:text-error-400">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={createMutation.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" loading={createMutation.isPending}>
          Create task
        </Button>
      </div>
    </form>
  );
}

export function MyTasksView() {
  const query = useMyTasks();
  const statusMutation = useUpdateMyTaskStatus();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);

  async function handleStatusChange(
    id: number,
    status: (typeof TASK_STATUSES)[number],
  ) {
    try {
      await statusMutation.mutateAsync({ id, status });
    } catch {
      toast({ title: "Could not update task status", variant: "error" });
    }
  }

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    const error = query.error;
    if (error instanceof ApiError && error.isPermissionError) {
      return <Alert variant="warning" title="You don't have access to tasks" />;
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const rows = query.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Tasks
        </h1>
        <Button onClick={() => setCreateOpen(true)}>New task</Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Create a task to see it listed here."
        />
      ) : (
        <DataTable<MyTask>
          columns={[
            { header: "Title", cell: (row) => row.title },
            { header: "Due", cell: (row) => row.dueDate },
            { header: "Priority", cell: (row) => row.priority },
            {
              header: "Status",
              cell: (row) => (
                <StatusBadge
                  label={row.status}
                  colorToken={STATUS_TOKEN[row.status] ?? "gray"}
                />
              ),
            },
            {
              header: "",
              headerClassName: "sr-only",
              className: "text-right",
              cell: (row) => (
                <Select
                  className="w-36"
                  value={row.status}
                  disabled={statusMutation.isPending}
                  onChange={(e) =>
                    void handleStatusChange(
                      row.id,
                      e.target.value as (typeof TASK_STATUSES)[number],
                    )
                  }
                >
                  {TASK_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </Select>
              ),
            },
          ]}
          rows={rows}
          getRowKey={(row) => String(row.id)}
        />
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New task"
      >
        <NewTaskForm onClose={() => setCreateOpen(false)} />
      </Dialog>
    </div>
  );
}
