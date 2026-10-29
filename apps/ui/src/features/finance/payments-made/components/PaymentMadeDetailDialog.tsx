"use client";

import type { FinancePaymentMade } from "@texawave-erp/api-types";
import { Button, Dialog } from "@texawave-erp/ui-kit";
import {
  Ban,
  Building2,
  Check,
  ExternalLink,
  FileText,
  Printer,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { formatDate, formatDateTime, formatMoney } from "../../shared/format";
import { PaymentMadeStatusBadge } from "./PaymentMadeStatusBadge";

export interface PaymentMadeDetailDialogProps {
  open: boolean;
  onClose: () => void;
  payment: FinancePaymentMade | null;
  canWrite: boolean;
  onConfirmClick?: ((payment: FinancePaymentMade) => void) | undefined;
  onVoidClick?: ((payment: FinancePaymentMade) => void) | undefined;
  onPrintClick?: ((payment: FinancePaymentMade) => void) | undefined;
}

export function PaymentMadeDetailDialog({
  open,
  onClose,
  payment,
  canWrite,
  onConfirmClick,
  onVoidClick,
  onPrintClick,
}: PaymentMadeDetailDialogProps) {
  if (!open || !payment) return null;

  const totalAmount = Number(payment.amount || 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/50">
            <Wallet className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-theme-lg font-bold text-gray-900 dark:text-white">
                {payment.paymentNumber}
              </span>
              <PaymentMadeStatusBadge status={payment.status} />
            </div>
            <p className="text-theme-xs font-normal text-gray-500 dark:text-gray-400">
              Vendor disbursement voucher audit record
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
              Disbursed Amount
            </span>
            <div className="text-xl font-extrabold text-blue-700 dark:text-sky-300">
              {formatMoney(totalAmount)}
            </div>
          </div>
          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Payment Date
            </span>
            <div className="text-theme-sm font-semibold text-gray-900 dark:text-white mt-1">
              {formatDate(payment.paymentDate)}
            </div>
          </div>
          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Payment Channel
            </span>
            <div className="text-theme-sm font-semibold text-gray-900 dark:text-white mt-1">
              {payment.paymentMode?.value ?? "Direct Disbursement"}
            </div>
          </div>
        </div>

        {/* Payee & Source Account Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1 rounded-xl border border-gray-200/70 p-3.5 dark:border-gray-800 bg-white dark:bg-gray-900/60">
            <span className="text-theme-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Vendor / Payee
            </span>
            <span className="text-theme-base font-bold text-gray-900 dark:text-white">
              {payment.vendorName}
            </span>
            {payment.billReference && (
              <div className="flex items-center gap-1.5 mt-1 text-theme-xs text-gray-600 dark:text-gray-300">
                <FileText className="h-3.5 w-3.5 text-blue-500" />
                <span>
                  Bill / PO Ref: <strong>{payment.billReference}</strong>
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1 rounded-xl border border-gray-200/70 p-3.5 dark:border-gray-800 bg-white dark:bg-gray-900/60">
            <span className="text-theme-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Disbursing Account & Reference
            </span>
            <div className="flex items-center gap-2 text-theme-base font-bold text-gray-900 dark:text-white">
              <Building2 className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <span>
                {payment.bankAccount?.accountName
                  ? `${payment.bankAccount.accountName} (${payment.bankAccount.accountNumber})`
                  : "Cash / Direct Vault"}
              </span>
            </div>
            {payment.referenceNumber && (
              <span className="text-theme-xs text-gray-500 dark:text-gray-400 mt-1">
                Ref / UTR:{" "}
                <strong className="text-gray-700 dark:text-gray-200">
                  {payment.referenceNumber}
                </strong>
              </span>
            )}
          </div>
        </div>

        {/* Remittance Narration */}
        {payment.notes && (
          <div className="flex flex-col gap-1 rounded-xl border border-gray-200/70 p-3.5 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
            <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400">
              Remittance Narration / Audit Notes
            </span>
            <p className="text-theme-sm text-gray-800 dark:text-gray-200">
              {payment.notes}
            </p>
          </div>
        )}

        {/* Linked Double-Entry Journal Entry */}
        <div className="flex flex-col gap-2 rounded-xl border border-gray-200/70 p-4 dark:border-gray-800 bg-white dark:bg-gray-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                <FileText className="h-4 w-4" />
              </div>
              <span className="text-theme-sm font-bold text-gray-900 dark:text-white">
                General Ledger Posting
              </span>
            </div>

            {payment.journalEntry ? (
              <span className="inline-flex items-center gap-1 text-theme-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md dark:bg-blue-950/60 dark:text-sky-300">
                <Check className="h-3.5 w-3.5" />
                Posted (Double-Entry)
              </span>
            ) : (
              <span className="text-theme-xs font-medium text-gray-400 dark:text-gray-500">
                Not Posted (Draft Staging)
              </span>
            )}
          </div>

          {payment.journalEntry ? (
            <div className="mt-2 flex flex-col gap-2 rounded-lg bg-gray-50/80 p-3 dark:bg-gray-800/60 text-theme-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Journal Voucher No:
                </span>
                <Link
                  href={`/finance/journal-entries?search=${payment.journalEntry.entryNumber}`}
                  className="inline-flex items-center gap-1 font-bold text-blue-600 hover:text-blue-700 hover:underline dark:text-sky-400"
                >
                  <span>{payment.journalEntry.entryNumber}</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Voucher Date:
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatDate(payment.journalEntry.entryDate)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-gray-400">
                  Double-Entry Posting:
                </span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Debit Accounts Payable (2010) / Credit Bank or Cash
                  (1020/1010)
                </span>
              </div>
            </div>
          ) : (
            <p className="text-theme-xs text-gray-500 dark:text-gray-400 mt-1">
              Draft disbursements do not impact the General Ledger until
              confirmed. Click &ldquo;Confirm & Post to GL&rdquo; to execute the
              double-entry voucher.
            </p>
          )}
        </div>

        {/* Audit Timestamps */}
        <div className="flex flex-wrap items-center justify-between text-theme-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-800">
          <span>Created: {formatDateTime(payment.createdAt)}</span>
          <span>Last Updated: {formatDateTime(payment.updatedAt)}</span>
        </div>

        {/* Actions Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-200/80 dark:border-gray-800">
          <Button
            type="button"
            variant="outline"
            onClick={() => onPrintClick?.(payment)}
            className="gap-2 text-gray-700 dark:text-gray-200"
          >
            <Printer className="h-4 w-4" />
            <span>Print Disbursement Voucher</span>
          </Button>

          <div className="flex items-center gap-2">
            {canWrite && payment.status === "DRAFT" && (
              <Button
                type="button"
                onClick={() => onConfirmClick?.(payment)}
                className="gap-1.5 bg-linear-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-semibold"
              >
                <Check className="h-4 w-4" />
                <span>Confirm & Post to GL</span>
              </Button>
            )}

            {canWrite &&
              (payment.status === "CONFIRMED" ||
                payment.status === "RECONCILED") && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onVoidClick?.(payment)}
                  className="gap-1.5 text-red-600 hover:bg-red-50 hover:border-red-200 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  <Ban className="h-4 w-4" />
                  <span>Void Disbursement</span>
                </Button>
              )}

            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
