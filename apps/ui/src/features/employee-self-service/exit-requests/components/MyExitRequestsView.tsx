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
import { useCreateMyExitRequest, useMyExitRequests } from "../hooks";
import type { MyExitRequest } from "../api";

const STATUS_TOKEN: Record<string, "success" | "warning" | "error" | "gray"> = {
  APPROVED: "success",
  SUBMITTED: "warning",
  REJECTED: "error",
};

function NewExitRequestForm({ onClose }: { onClose: () => void }) {
  const createMutation = useCreateMyExitRequest();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [preferredLastWorkingDate, setPreferredLastWorkingDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createMutation.mutateAsync({ reason, preferredLastWorkingDate });
      toast({ title: "Exit request submitted", variant: "success" });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not submit this request. Check the fields and try again.",
      );
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="flex flex-col gap-4"
    >
      <FormField label="Reason for leaving" required>
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        )}
      </FormField>
      <FormField label="Preferred last working day" required>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            type="date"
            value={preferredLastWorkingDate}
            onChange={(e) => setPreferredLastWorkingDate(e.target.value)}
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
          Submit request
        </Button>
      </div>
    </form>
  );
}

export function MyExitRequestsView() {
  const query = useMyExitRequests();
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
        <Alert
          variant="warning"
          title="You don't have access to exit requests"
        />
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const rows = query.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Exit Requests
        </h1>
        <Button onClick={() => setCreateOpen(true)}>Submit request</Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No exit requests"
          description="Submit a request to see it listed here."
        />
      ) : (
        <DataTable<MyExitRequest>
          columns={[
            { header: "Reason", cell: (row) => row.reason },
            {
              header: "Preferred last day",
              cell: (row) => row.preferredLastWorkingDate,
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
        title="Submit exit request"
      >
        <NewExitRequestForm onClose={() => setCreateOpen(false)} />
      </Dialog>
    </div>
  );
}
