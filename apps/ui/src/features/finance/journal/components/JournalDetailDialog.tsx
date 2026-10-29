"use client";

import type { FinanceJournalEntry } from "@texawave-erp/api-types";
import { Button, Dialog } from "@texawave-erp/ui-kit";
import { Check, RotateCcw } from "lucide-react";
import { formatDate, formatDateTime, formatMoney } from "../../shared/format";
import { AccountBadge } from "../../../finance/coa/components/AccountBadge";
import { JournalEntryStatusBadge } from "./JournalEntryStatusBadge";
import { JournalEntryTypeBadge } from "./JournalEntryTypeBadge";

export interface JournalDetailDialogProps {
  open: boolean;
  onClose: () => void;
  entry: FinanceJournalEntry | null;
  canPost: boolean;
  onPostClick?: (entry: FinanceJournalEntry) => void;
  onReverseClick?: (entry: FinanceJournalEntry) => void;
}

export function JournalDetailDialog({
  open,
  onClose,
  entry,
  canPost,
  onPostClick,
  onReverseClick,
}: JournalDetailDialogProps) {
  if (!open || !entry) return null;

  const lines = entry.lines ?? [];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <span>Voucher {entry.entryNumber}</span>
          <JournalEntryStatusBadge status={entry.status} />
          <JournalEntryTypeBadge type={entry.entryType} />
        </div>
      }
      size="3xl"
    >
      <div className="flex flex-col gap-5">
        {/* Header Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 text-theme-xs">
          <div className="flex flex-col gap-0.5">
            <span className="text-gray-500 dark:text-gray-400">
              Posting Date
            </span>
            <span className="font-semibold text-theme-sm text-gray-900 dark:text-white">
              {formatDate(entry.entryDate)}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-gray-500 dark:text-gray-400">
              Reference #
            </span>
            <span className="font-semibold text-theme-sm text-gray-900 dark:text-white">
              {entry.referenceNumber ?? "—"}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-gray-500 dark:text-gray-400">
              Total Debit
            </span>
            <span className="font-semibold text-theme-sm text-gray-900 dark:text-white">
              {formatMoney(entry.totalDebit)}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-gray-500 dark:text-gray-400">
              Total Credit
            </span>
            <span className="font-semibold text-theme-sm text-gray-900 dark:text-white">
              {formatMoney(entry.totalCredit)}
            </span>
          </div>
        </div>

        {/* Narration */}
        <div className="flex flex-col gap-1 p-3.5 rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900">
          <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Narration / Business Purpose
          </span>
          <p className="text-theme-sm text-gray-800 dark:text-gray-200">
            {entry.narration}
          </p>
        </div>

        {/* Lines Table */}
        <div className="flex flex-col gap-2">
          <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Journal Line Items ({lines.length})
          </span>

          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-left border-collapse text-theme-xs">
              <thead className="bg-gray-50 dark:bg-gray-850 border-b border-gray-200 dark:border-gray-800">
                <tr>
                  <th className="py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-300">
                    #
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-300">
                    Account
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-300">
                    Classification
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-300">
                    Line Memo
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-300 text-right">
                    Debit
                  </th>
                  <th className="py-2.5 px-3 font-semibold text-gray-600 dark:text-gray-300 text-right">
                    Credit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                {lines.map((line, idx) => (
                  <tr
                    key={line.id}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-850/50"
                  >
                    <td className="py-2.5 px-3 text-gray-400">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-white">
                        <span className="font-semibold">
                          {line.account?.accountCode ?? "—"}
                        </span>
                        <span>—</span>
                        <span>
                          {line.account?.accountName ??
                            `Account #${line.accountId}`}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      {line.account ? (
                        <AccountBadge
                          type={line.account.accountType as string}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">
                      {line.description ?? "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-gray-900 dark:text-white">
                      {Number(line.debit) > 0 ? formatMoney(line.debit) : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-gray-900 dark:text-white">
                      {Number(line.credit) > 0 ? formatMoney(line.credit) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-850/80 font-semibold text-theme-sm">
                <tr>
                  <td colSpan={4} className="py-2.5 px-3 text-right">
                    Total:
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-900 dark:text-white">
                    {formatMoney(entry.totalDebit)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-900 dark:text-white">
                    {formatMoney(entry.totalCredit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Audit & Posting Timeline */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-[11px] text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-4">
            <span>Created: {formatDateTime(entry.createdAt)}</span>
            {entry.postedAt ? (
              <span>Posted: {formatDateTime(entry.postedAt)}</span>
            ) : null}
            {entry.reversedEntryId ? (
              <span className="text-amber-600 dark:text-amber-400">
                Reversal Voucher Linked: #{entry.reversedEntryId}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {entry.status === "DRAFT" && canPost && onPostClick ? (
              <Button
                size="sm"
                onClick={() => onPostClick(entry)}
                className="gap-1.5"
              >
                <Check className="h-4 w-4" />
                <span>Post Voucher</span>
              </Button>
            ) : null}

            {entry.status === "POSTED" && canPost && onReverseClick ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReverseClick(entry)}
                className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-950/40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reverse Voucher</span>
              </Button>
            ) : null}

            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
