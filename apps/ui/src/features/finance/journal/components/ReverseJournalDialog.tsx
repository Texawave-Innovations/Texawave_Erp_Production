"use client";

import { useState } from "react";
import type { FinanceJournalEntry } from "@texawave-erp/api-types";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
  Textarea,
} from "@texawave-erp/ui-kit";
import { reverseJournalEntrySchema } from "../schema";

export interface ReverseJournalDialogProps {
  open: boolean;
  onClose: () => void;
  entry: FinanceJournalEntry | null;
  onConfirm: (payload: {
    reversalDate?: string | undefined;
    reason: string;
  }) => Promise<void>;
  loading?: boolean | undefined;
}

export function ReverseJournalDialog({
  open,
  onClose,
  entry,
  onConfirm,
  loading = false,
}: ReverseJournalDialogProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [reversalDate, setReversalDate] = useState(today);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open || !entry) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = reverseJournalEntrySchema.safeParse({
      reversalDate,
      reason,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid reversal input");
      return;
    }

    try {
      await onConfirm({
        reversalDate: parsed.data.reversalDate,
        reason: parsed.data.reason,
      });
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to reverse journal voucher. Please try again.",
      );
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Reverse Voucher ${entry.entryNumber}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Alert variant="warning" title="Irreversible Accounting Operation">
          Reversing this posted voucher will automatically generate a new
          counter-entry (REVERSAL voucher) with swapped debit and credit lines,
          restoring the original account ledger balances.
        </Alert>

        {error ? (
          <Alert variant="error" title="Reversal Error">
            {error}
          </Alert>
        ) : null}

        <FormField
          label="Reversal Date"
          hint="Date the reversal voucher takes effect in general ledger"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="date"
              value={reversalDate}
              onChange={(e) => setReversalDate(e.target.value)}
              disabled={loading}
            />
          )}
        </FormField>

        <FormField
          label="Reason for Reversal"
          required
          hint="Audit explanation required for statutory compliance"
        >
          {(fieldProps) => (
            <Textarea
              {...fieldProps}
              placeholder="e.g. Inadvertent duplication of invoice posting..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
              rows={3}
            />
          )}
        </FormField>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Confirm Reversal
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
