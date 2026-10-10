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
import { useCreateMyTicket, useMyTickets } from "../hooks";
import { TICKET_CATEGORIES, type MyTicket } from "../api";

const STATUS_TOKEN: Record<string, "success" | "warning" | "gray"> = {
  RESOLVED: "success",
  CLOSED: "success",
  IN_PROGRESS: "warning",
  OPEN: "gray",
};

function NewTicketForm({ onClose }: { onClose: () => void }) {
  const createMutation = useCreateMyTicket();
  const { toast } = useToast();
  const [category, setCategory] = useState<(typeof TICKET_CATEGORIES)[number]>(
    TICKET_CATEGORIES[0],
  );
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createMutation.mutateAsync({ category, subject, description });
      toast({ title: "Ticket raised", variant: "success" });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not raise this ticket. Check the fields and try again.",
      );
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="flex flex-col gap-4"
    >
      <FormField label="Category" required>
        {(fieldProps) => (
          <Select
            {...fieldProps}
            value={category}
            onChange={(e) =>
              setCategory(e.target.value as (typeof TICKET_CATEGORIES)[number])
            }
            required
          >
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField label="Subject" required>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            maxLength={200}
          />
        )}
      </FormField>
      <FormField label="Description" required>
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            maxLength={5000}
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
          Raise ticket
        </Button>
      </div>
    </form>
  );
}

export function MyTicketsView() {
  const query = useMyTickets();
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
        <Alert variant="warning" title="You don't have access to tickets" />
      );
    }
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  const rows = query.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-white/90">
          Tickets
        </h1>
        <Button onClick={() => setCreateOpen(true)}>Raise ticket</Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No tickets yet"
          description="Raise a ticket to see it listed here."
        />
      ) : (
        <DataTable<MyTicket>
          columns={[
            { header: "Subject", cell: (row) => row.subject },
            { header: "Category", cell: (row) => row.category },
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
        title="Raise ticket"
      >
        <NewTicketForm onClose={() => setCreateOpen(false)} />
      </Dialog>
    </div>
  );
}
