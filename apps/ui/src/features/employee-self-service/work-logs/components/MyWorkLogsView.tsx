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
  Skeleton,
  StatusBadge,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { ApiError } from "@texawave-erp/core";
import { useState } from "react";
import { useCreateMyWorkLog, useMyWorkLogs } from "../hooks";
import type { MyWorkLog } from "../api";

const STATUS_TOKEN: Record<string, "success" | "warning" | "error" | "gray"> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "error",
};

function NewWorkLogForm({ onClose }: { onClose: () => void }) {
  const createMutation = useCreateMyWorkLog();
  const { toast } = useToast();
  const [workDate, setWorkDate] = useState("");
  const [hoursWorked, setHoursWorked] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createMutation.mutateAsync({
        workDate,
        hoursWorked: Number(hoursWorked),
        taskDescription,
      });
      toast({ title: "Work log submitted", variant: "success" });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not submit this log. Check the fields and try again.",
      );
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="flex flex-col gap-4"
    >
      <FormField label="Date" required>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            type="date"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            required
          />
        )}
      </FormField>
      <FormField label="Hours worked" required>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            type="number"
            step="0.25"
            min="0.01"
            max="24"
            value={hoursWorked}
            onChange={(e) => setHoursWorked(e.target.value)}
            required
          />
        )}
      </FormField>
      <FormField label="What did you work on?" required>
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            required
            minLength={3}
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
          Submit log
        </Button>
      </div>
    </form>
  );
}

export function MyWorkLogsView() {
  const query = useMyWorkLogs();
  const [createOpen, setCreateOpen] = useState(false);

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
      return (
        <Alert variant="warning" title="You don't have access to work logs" />
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const rows = query.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Work Logs
        </h1>
        <Button onClick={() => setCreateOpen(true)}>Log work</Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No work logs yet"
          description="Submit a log to see it listed here."
        />
      ) : (
        <DataTable<MyWorkLog>
          columns={[
            { header: "Date", cell: (row) => row.workDate },
            { header: "Hours", cell: (row) => row.hoursWorked },
            {
              header: "What was worked on",
              cell: (row) => row.taskDescription,
            },
            {
              header: "Status",
              cell: (row) => (
                <StatusBadge
                  label={row.status}
                  colorToken={STATUS_TOKEN[row.status] ?? "gray"}
                />
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
        title="Log work"
      >
        <NewWorkLogForm onClose={() => setCreateOpen(false)} />
      </Dialog>
    </div>
  );
}
