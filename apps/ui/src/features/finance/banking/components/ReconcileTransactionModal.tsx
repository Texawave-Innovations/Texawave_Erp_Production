"use client";

import { useState } from "react";
import type { FinanceBankTransaction } from "@texawave-erp/api-types";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
  useToast,
} from "@texawave-erp/ui-kit";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { formatDate, formatMoney } from "../../shared/format";
import { useReconcileBankTransaction } from "../hooks";
import { reconcileTransactionSchema } from "../schema";

export interface ReconcileTransactionModalProps {
  open: boolean;
  onClose: () => void;
  transaction: FinanceBankTransaction | null;
  onSuccess?: (() => void) | undefined;
}

export function ReconcileTransactionModal({
  open,
  onClose,
  transaction,
  onSuccess,
}: ReconcileTransactionModalProps) {
  const { toast } = useToast();
  const reconcileMutation = useReconcileBankTransaction();
  const today = new Date().toISOString().slice(0, 10);

  const [statementDate, setStatementDate] = useState(today);
  const [reconciliationReference, setReconciliationReference] = useState("");
  const [matchedJournalEntryId, setMatchedJournalEntryId] = useState<
    number | ""
  >("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!transaction) return null;

  const handleClose = () => {
    setStatementDate(today);
    setReconciliationReference("");
    setMatchedJournalEntryId("");
    setSubmitError(null);
    setErrors({});
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setErrors({});

    const parseResult = reconcileTransactionSchema.safeParse({
      statementDate,
      reconciliationReference: reconciliationReference || null,
      matchedJournalEntryId: matchedJournalEntryId
        ? Number(matchedJournalEntryId)
        : null,
    });

    if (!parseResult.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parseResult.error.issues) {
        const path = issue.path[0];
        if (typeof path === "string") {
          fieldErrors[path] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      await reconcileMutation.mutateAsync({
        id: transaction.id,
        input: {
          ...(parseResult.data.matchedJournalEntryId
            ? { matchedJournalEntryId: parseResult.data.matchedJournalEntryId }
            : {}),
        },
      });

      toast({
        title: `Transaction #${transaction.id} reconciled against bank statement`,
        variant: "success",
      });
      handleClose();
      onSuccess?.();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to reconcile transaction",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isCredit = transaction.transactionType === "CREDIT";

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <span>Reconcile Bank Transaction #{transaction.id}</span>
        </div>
      }
      size="xl"
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-5 text-theme-sm relative focus-within:z-30"
      >
        {submitError && (
          <Alert variant="error" title="Reconciliation Failed">
            {submitError}
          </Alert>
        )}

        {/* Transaction Summary Box */}
        <div className="rounded-xl border border-gray-200/80 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/50">
          <div className="flex items-center justify-between border-b border-gray-200/60 pb-3 dark:border-gray-700/60">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-theme-xs font-bold ${
                  isCredit
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                }`}
              >
                {isCredit ? (
                  <ArrowDownLeft className="h-3.5 w-3.5" />
                ) : (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                )}
                <span>{isCredit ? "Credit (Inflow)" : "Debit (Outflow)"}</span>
              </span>
              <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                {formatDate(transaction.transactionDate)}
              </span>
            </div>

            <span className="text-lg font-black text-gray-900 dark:text-white">
              {formatMoney(transaction.amount)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 text-theme-xs">
            <div>
              <span className="text-gray-500 dark:text-gray-400">
                Bank Account:
              </span>
              <p className="font-semibold text-gray-900 dark:text-white">
                {transaction.bankAccount?.accountName ??
                  `Account #${transaction.bankAccountId}`}
              </p>
            </div>

            <div>
              <span className="text-gray-500 dark:text-gray-400">
                Reference / UTR:
              </span>
              <p className="font-semibold text-gray-900 dark:text-white">
                {transaction.referenceNumber || "—"}
              </p>
            </div>

            <div className="col-span-2">
              <span className="text-gray-500 dark:text-gray-400">
                Narrative / Description:
              </span>
              <p className="font-medium text-gray-800 dark:text-gray-200">
                {transaction.description}
              </p>
            </div>
          </div>
        </div>

        {/* Statement Verification Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Statement Verification Date"
            required
            error={errors.statementDate}
            hint="Date the transaction cleared on bank statement"
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="date"
                max={today}
                value={statementDate}
                onChange={(e) => setStatementDate(e.target.value)}
              />
            )}
          </FormField>

          <FormField
            label="Statement Reference / Clearance Note"
            error={errors.reconciliationReference}
            hint="e.g. Oct Statement Line 14 or UTR Confirmed"
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                placeholder="e.g. Bank Statement Page 3"
                value={reconciliationReference}
                onChange={(e) => setReconciliationReference(e.target.value)}
              />
            )}
          </FormField>
        </div>

        {/* Optional Journal Entry Match */}
        <FormField
          label="Matched Journal Entry Voucher ID (Optional)"
          error={errors.matchedJournalEntryId}
          hint="ID of the FinanceJournalEntry if matching against an existing ledger voucher"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="number"
              placeholder="e.g. 50"
              value={matchedJournalEntryId}
              onChange={(e) =>
                setMatchedJournalEntryId(
                  e.target.value ? Number(e.target.value) : "",
                )
              }
            />
          )}
        </FormField>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            <span>
              {submitting ? "Reconciling..." : "Confirm Reconciliation"}
            </span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
