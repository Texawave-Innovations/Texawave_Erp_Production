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
  useToast,
} from "@texawave-erp/ui-kit";
import { ApiError } from "@texawave-erp/core";
import { useState } from "react";
import { useCreateMyExpenseClaim, useMyExpenseClaims } from "../hooks";
import { EXPENSE_TYPES, type MyExpenseClaim } from "../api";

const STATUS_TOKEN: Record<string, "success" | "warning" | "error"> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "error",
};

function NewExpenseClaimForm({ onClose }: { onClose: () => void }) {
  const createMutation = useCreateMyExpenseClaim();
  const { toast } = useToast();
  const [expenseType, setExpenseType] = useState<
    (typeof EXPENSE_TYPES)[number]
  >(EXPENSE_TYPES[0]);
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createMutation.mutateAsync({
        expenseType,
        amount: Number(amount),
        expenseDate,
        description,
      });
      toast({ title: "Expense claim submitted", variant: "success" });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not submit this claim. Check the fields and try again.",
      );
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="flex flex-col gap-4"
    >
      <FormField label="Type" required>
        {(fieldProps) => (
          <Select
            {...fieldProps}
            value={expenseType}
            onChange={(e) =>
              setExpenseType(e.target.value as (typeof EXPENSE_TYPES)[number])
            }
            required
          >
            {EXPENSE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Amount" required>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          )}
        </FormField>
        <FormField label="Date" required>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
            />
          )}
        </FormField>
      </div>
      <FormField label="What was this for?" required>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            maxLength={300}
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
          Submit claim
        </Button>
      </div>
    </form>
  );
}

export function MyExpenseClaimsView() {
  const query = useMyExpenseClaims();
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
          title="You don't have access to expense claims"
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
          Expense Claims
        </h1>
        <Button onClick={() => setCreateOpen(true)}>Submit claim</Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No expense claims yet"
          description="Submit a claim to see it listed here."
        />
      ) : (
        <DataTable<MyExpenseClaim>
          columns={[
            { header: "Type", cell: (row) => row.expenseType },
            { header: "Amount", cell: (row) => row.amount },
            { header: "Date", cell: (row) => row.expenseDate },
            { header: "Description", cell: (row) => row.description },
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
        title="Submit expense claim"
      >
        <NewExpenseClaimForm onClose={() => setCreateOpen(false)} />
      </Dialog>
    </div>
  );
}
