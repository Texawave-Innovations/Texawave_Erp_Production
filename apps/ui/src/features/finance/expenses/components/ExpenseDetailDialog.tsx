"use client";

import type { FinanceExpense } from "@texawave-erp/api-types";
import { Button, Dialog } from "@texawave-erp/ui-kit";
import {
  Ban,
  Building2,
  ExternalLink,
  FileText,
  Pencil,
  Receipt,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { formatDate, formatDateTime, formatMoney } from "../../shared/format";
import { ExpenseStatusBadge } from "./ExpenseStatusBadge";

export interface ExpenseDetailDialogProps {
  open: boolean;
  onClose: () => void;
  expense: FinanceExpense | null;
  canWrite: boolean;
  onPayClick?: ((expense: FinanceExpense) => void) | undefined;
  onEditClick?: ((expense: FinanceExpense) => void) | undefined;
  onCancelClick?: ((expense: FinanceExpense) => void) | undefined;
}

export function ExpenseDetailDialog({
  open,
  onClose,
  expense,
  canWrite,
  onPayClick,
  onEditClick,
  onCancelClick,
}: ExpenseDetailDialogProps) {
  if (!open || !expense) return null;

  const expenseAmount = Number(expense.netAmount || expense.amount || 0);

  const isDraftOrPending =
    expense.status === "DRAFT" || expense.status === "PENDING_APPROVAL";
  const canDisburse =
    expense.status !== "PAID" && expense.status !== "CANCELLED";
  const canCancel = expense.status !== "CANCELLED";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/50">
            <Receipt className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-theme-lg font-bold text-gray-900 dark:text-white">
                {expense.expenseNumber}
              </span>
              <ExpenseStatusBadge status={expense.status} />
            </div>
            <p className="text-theme-xs font-normal text-gray-500 dark:text-gray-400">
              Operational expense voucher audit record
            </p>
          </div>
        </div>
      }
      size="2xl"
    >
      <div className="flex flex-col gap-6 relative focus-within:z-30">
        {/* Primary Metrics Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl bg-linear-to-r from-blue-50/70 via-sky-50/40 to-slate-50/60 p-4 border border-blue-100/70 dark:bg-gray-800/50 dark:border-gray-700/60 shadow-xs">
          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Disbursement Amount
            </span>
            <div className="text-xl font-extrabold text-blue-700 dark:text-sky-300">
              {formatMoney(expenseAmount)}
            </div>
          </div>
          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Incurred Date
            </span>
            <div className="text-theme-sm font-semibold text-gray-900 dark:text-white mt-1">
              {formatDate(expense.expenseDate)}
            </div>
          </div>
          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Category
            </span>
            <div className="text-theme-sm font-semibold text-gray-900 dark:text-white mt-1">
              {expense.expenseType?.value || "Uncategorized"}
            </div>
          </div>
        </div>

        {/* Detailed Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Payee & Disbursement Details */}
          <div className="rounded-xl border border-gray-200/80 p-4 dark:border-gray-700/80 space-y-3">
            <h4 className="text-theme-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Payee & Disbursement Details
            </h4>
            <div className="space-y-2 text-theme-sm">
              <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500 dark:text-gray-400">
                  Vendor / Payee
                </span>
                <span className="font-semibold text-gray-900 dark:text-white text-right">
                  {expense.vendorName || "—"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500 dark:text-gray-400">
                  Payment Mode
                </span>
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {expense.paymentMode?.value || "Not Set"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500 dark:text-gray-400">
                  Bank Account
                </span>
                <span className="font-medium text-gray-800 dark:text-gray-200 text-right">
                  {expense.bankAccount ? (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-sky-400" />
                      {expense.bankAccount.bankName} (
                      {expense.bankAccount.accountNumber.slice(-4)})
                    </span>
                  ) : (
                    "—"
                  )}
                </span>
              </div>
              {expense.hrExpenseClaimId && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500 dark:text-gray-400">
                    Linked HR Claim
                  </span>
                  <span className="font-semibold text-blue-600 dark:text-sky-400">
                    Claim #{expense.hrExpenseClaimId}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* General Ledger & Accounting */}
          <div className="rounded-xl border border-gray-200/80 p-4 dark:border-gray-700/80 space-y-3">
            <h4 className="text-theme-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              General Ledger & Audit
            </h4>
            <div className="space-y-2 text-theme-sm">
              <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500 dark:text-gray-400">
                  GL Account
                </span>
                <span className="font-medium text-gray-800 dark:text-gray-200 text-right">
                  {expense.glAccount
                    ? `${expense.glAccount.accountCode} - ${expense.glAccount.accountName}`
                    : "Operating Expense Head"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500 dark:text-gray-400">
                  Journal Entry
                </span>
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {expense.journalEntry ? (
                    <Link
                      href="/finance/journal-entries"
                      className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800 dark:text-sky-400 dark:hover:text-sky-300 hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {expense.journalEntry.entryNumber}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : (
                    <span className="text-gray-400">Not Posted to GL</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-gray-800">
                <span className="text-gray-500 dark:text-gray-400">
                  Created At
                </span>
                <span className="text-theme-xs text-gray-600 dark:text-gray-300">
                  {formatDateTime(expense.createdAt)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-gray-500 dark:text-gray-400">
                  Last Updated
                </span>
                <span className="text-theme-xs text-gray-600 dark:text-gray-300">
                  {formatDateTime(expense.updatedAt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Receipt URL & Notes */}
        {(expense.receiptUrl || expense.notes) && (
          <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/40 border border-gray-200/60 dark:border-gray-700/50 space-y-2">
            {expense.receiptUrl && (
              <div className="flex items-center gap-2 text-theme-xs">
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  Receipt Document:
                </span>
                <a
                  href={expense.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline dark:text-sky-400 inline-flex items-center gap-1"
                >
                  View Attached Receipt
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            {expense.notes && (
              <p className="text-theme-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                <span className="font-semibold text-gray-700 dark:text-gray-200">
                  Notes:{" "}
                </span>
                {expense.notes}
              </p>
            )}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {canWrite && canCancel && (
              <Button
                variant="outline"
                className="text-rose-600 hover:bg-rose-50 border-rose-200 dark:text-rose-400 dark:border-rose-900/50"
                onClick={() => {
                  onClose();
                  onCancelClick?.(expense);
                }}
              >
                <Ban className="h-4 w-4 mr-1.5" />
                Cancel Expense
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {canWrite && isDraftOrPending && (
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  onEditClick?.(expense);
                }}
              >
                <Pencil className="h-4 w-4 mr-1.5" />
                Edit
              </Button>
            )}

            {canWrite && canDisburse && (
              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  onPayClick?.(expense);
                }}
              >
                <Wallet className="h-4 w-4 mr-1.5" />
                Disburse Payment
              </Button>
            )}

            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
