"use client";

import type { FinanceBankTransaction } from "@texawave-erp/api-types";
import { Button, Dialog, StatusBadge } from "@texawave-erp/ui-kit";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  Undo2,
} from "lucide-react";
import { formatDate, formatDateTime, formatMoney } from "../../shared/format";

export interface BankTransactionDetailDialogProps {
  open: boolean;
  onClose: () => void;
  transaction: FinanceBankTransaction | null;
  canWrite?: boolean;
  onReconcile?: ((tx: FinanceBankTransaction) => void) | undefined;
  onUnreconcile?: ((tx: FinanceBankTransaction) => void) | undefined;
}

export function BankTransactionDetailDialog({
  open,
  onClose,
  transaction,
  canWrite,
  onReconcile,
  onUnreconcile,
}: BankTransactionDetailDialogProps) {
  if (!transaction) return null;

  const isCredit = transaction.transactionType === "CREDIT";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5 text-[#1769F5] dark:text-sky-400" />
          <span>Bank Transaction Details: #{transaction.id}</span>
        </div>
      }
      size="xl"
    >
      <div className="space-y-5 text-theme-sm relative focus-within:z-30">
        {/* Hero Card */}
        <div className="rounded-2xl border border-blue-200/80 bg-linear-to-br from-blue-50/80 via-white to-sky-50/40 p-5 shadow-xs dark:border-blue-900/50 dark:from-blue-950/30 dark:via-gray-900 dark:to-sky-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-xs ${
                  isCredit ? "bg-emerald-600" : "bg-amber-600"
                }`}
              >
                {isCredit ? (
                  <ArrowDownLeft className="h-5 w-5" />
                ) : (
                  <ArrowUpRight className="h-5 w-5" />
                )}
              </div>
              <div>
                <span className="text-theme-xs font-semibold text-gray-500 uppercase dark:text-gray-400">
                  {isCredit
                    ? "Credit (Deposit / Inflow)"
                    : "Debit (Withdrawal / Outflow)"}
                </span>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {isCredit ? "+" : "-"}
                  {formatMoney(transaction.amount)}
                </h3>
              </div>
            </div>

            <div className="flex flex-col sm:items-end">
              <span className="text-theme-xs font-semibold text-gray-500 uppercase dark:text-gray-400">
                Balance After
              </span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {transaction.balanceAfter
                  ? formatMoney(transaction.balanceAfter)
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-gray-200/80 p-4 dark:border-gray-800 dark:bg-gray-900/50">
          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Transaction Date
            </span>
            <p className="font-semibold text-gray-900 dark:text-white">
              {formatDate(transaction.transactionDate)}
            </p>
          </div>

          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Reference / UTR / Cheque No.
            </span>
            <p className="font-semibold text-gray-900 dark:text-white">
              {transaction.referenceNumber || "—"}
            </p>
          </div>

          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Target Bank Account
            </span>
            <p className="font-semibold text-gray-900 dark:text-white">
              {transaction.bankAccount?.accountName ??
                `Account #${transaction.bankAccountId}`}
            </p>
            {transaction.bankAccount && (
              <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                A/C: {transaction.bankAccount.accountNumber}
              </span>
            )}
          </div>

          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Reconciliation Status
            </span>
            <div className="mt-0.5 flex items-center gap-2">
              <StatusBadge
                label={transaction.isReconciled ? "Reconciled" : "Unreconciled"}
                colorToken={transaction.isReconciled ? "success" : "gray"}
              />
              {transaction.reconciledAt && (
                <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                  on {formatDateTime(transaction.reconciledAt)}
                </span>
              )}
            </div>
          </div>

          <div className="sm:col-span-2">
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Description / Narrative
            </span>
            <p className="font-medium text-gray-900 dark:text-white">
              {transaction.description}
            </p>
          </div>

          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Matched General Ledger Voucher
            </span>
            <p className="font-semibold text-gray-900 dark:text-white">
              {transaction.matchedEntry ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2 py-0.5 text-theme-xs font-bold text-blue-700 dark:bg-blue-950/60 dark:text-sky-300 border border-blue-200/50">
                  {transaction.matchedEntry.entryNumber} (
                  {transaction.matchedEntry.status})
                </span>
              ) : transaction.matchedJournalEntryId ? (
                `Voucher #${transaction.matchedJournalEntryId}`
              ) : (
                "No GL Voucher Linked"
              )}
            </p>
          </div>

          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Recorded In System
            </span>
            <p className="font-medium text-gray-700 dark:text-gray-300">
              {formatDateTime(transaction.createdAt)}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-800">
          <div>
            {canWrite && !transaction.isReconciled && onReconcile && (
              <Button
                onClick={() => {
                  onClose();
                  onReconcile(transaction);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Check className="h-4 w-4 mr-1.5" />
                <span>Reconcile Transaction</span>
              </Button>
            )}

            {canWrite && transaction.isReconciled && onUnreconcile && (
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  onUnreconcile(transaction);
                }}
                className="text-amber-700 border-amber-300 hover:bg-amber-50"
              >
                <Undo2 className="h-4 w-4 mr-1.5" />
                <span>Unmark Reconciled</span>
              </Button>
            )}
          </div>

          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
