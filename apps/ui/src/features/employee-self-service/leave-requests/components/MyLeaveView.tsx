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
import {
  useCancelMyLeaveRequest,
  useCreateMyLeaveRequest,
  useLeaveTypes,
  useMyLeaveRequests,
} from "../hooks";
import type { MyLeaveRequest } from "../api";

const STATUS_TOKEN: Record<string, "success" | "warning" | "error" | "gray"> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "error",
  CANCELLED: "gray",
};

function NewLeaveRequestForm({ onClose }: { onClose: () => void }) {
  const leaveTypes = useLeaveTypes();
  const createMutation = useCreateMyLeaveRequest();
  const { toast } = useToast();

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createMutation.mutateAsync({
        leaveTypeId: Number(leaveTypeId),
        startDate,
        endDate,
        reason,
      });
      toast({ title: "Leave request submitted", variant: "success" });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not submit this request. Check the fields and try again.",
      );
    }
  }

  if (leaveTypes.isPending) return <Skeleton className="h-40 w-full" />;
  if (leaveTypes.isError || !leaveTypes.data) {
    return <Alert variant="error" title="Could not load leave types" />;
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="flex flex-col gap-4"
    >
      <FormField label="Leave type" required>
        {(fieldProps) => (
          <Select
            {...fieldProps}
            value={leaveTypeId}
            onChange={(e) => setLeaveTypeId(e.target.value)}
            required
          >
            <option value="">Select a leave type</option>
            {leaveTypes.data.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Start date" required>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          )}
        </FormField>
        <FormField label="End date" required>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          )}
        </FormField>
      </div>
      <FormField label="Reason" required>
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
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
          Submit request
        </Button>
      </div>
    </form>
  );
}

export function MyLeaveView() {
  const query = useMyLeaveRequests();
  const cancelMutation = useCancelMyLeaveRequest();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);

  async function handleCancel(id: number) {
    try {
      await cancelMutation.mutateAsync(id);
      toast({ title: "Leave request cancelled", variant: "success" });
    } catch {
      toast({ title: "Could not cancel this request", variant: "error" });
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
      return (
        <Alert
          variant="warning"
          title="You don't have access to leave requests"
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
          Leave
        </h1>
        <Button onClick={() => setCreateOpen(true)}>Request leave</Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No leave requests yet"
          description="Request leave to see it listed here."
        />
      ) : (
        <DataTable<MyLeaveRequest>
          columns={[
            {
              header: "Dates",
              cell: (row) => `${row.startDate} – ${row.endDate}`,
            },
            { header: "Reason", cell: (row) => row.reason },
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
              cell: (row) =>
                row.status === "PENDING" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleCancel(row.id)}
                    disabled={cancelMutation.isPending}
                  >
                    Cancel
                  </Button>
                ) : null,
            },
          ]}
          rows={rows}
          getRowKey={(row) => String(row.id)}
        />
      )}

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Request leave"
      >
        <NewLeaveRequestForm onClose={() => setCreateOpen(false)} />
      </Dialog>
    </div>
  );
}
