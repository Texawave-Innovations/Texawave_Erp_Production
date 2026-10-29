"use client";

import type { FinanceGstEntry } from "@texawave-erp/api-types";
import { Button, Dialog, ErrorState, StatusBadge } from "@texawave-erp/ui-kit";
import {
  AlertCircle,
  Check,
  ExternalLink,
  FileText,
  Hash,
  Receipt,
  RefreshCw,
  User,
} from "lucide-react";
import Link from "next/link";
import { formatDateTime, formatMoney } from "../../shared/format";
import { useGstEntry } from "../hooks";

export interface GstEntryDetailDialogProps {
  entry: FinanceGstEntry | null;
  open: boolean;
  onClose: () => void;
}

export function GstEntryDetailDialog({
  entry,
  open,
  onClose,
}: GstEntryDetailDialogProps) {
  const {
    data: fetchedEntry,
    isLoading,
    isError,
    error,
  } = useGstEntry(open && entry ? entry.id : undefined);

  if (!open || !entry) return null;

  const current = fetchedEntry ?? entry;
  const totalValue =
    Number(current.taxableAmount || 0) + Number(current.totalTaxAmount || 0);

  const getStatusColorToken = (status: string) => {
    switch (status) {
      case "RECONCILED":
        return "success";
      case "FILED":
        return "brand";
      case "ACTIVE":
        return "brand";
      case "CANCELLED":
        return "error";
      default:
        return "gray";
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-[#1769F5] dark:text-sky-400" />
          <span>
            GST Entry #{current.id} — {current.sourceReference}
          </span>
        </div>
      }
      size="xl"
    >
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-10">
          <RefreshCw className="h-7 w-7 text-[#1769F5] animate-spin" />
          <span className="mt-2 text-theme-xs text-gray-500">
            Loading entry details...
          </span>
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to Load Entry Details"
          description={
            (error as Error)?.message ||
            "Entry could not be retrieved from the server."
          }
        />
      ) : (
        <div className="space-y-5 text-theme-sm">
          {/* Header Badges */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 dark:text-white">
                Status:
              </span>
              <StatusBadge
                label={current.status}
                colorToken={getStatusColorToken(current.status)}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 dark:text-white">
                Entry Type:
              </span>
              <span
                className={`rounded-lg px-2.5 py-1 text-theme-xs font-bold ${
                  current.entryType === "OUTPUT_GST"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-sky-300"
                    : "bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-200"
                }`}
              >
                {current.entryType === "OUTPUT_GST"
                  ? "OUTPUT GST (Outward Liability)"
                  : "INPUT TAX CREDIT (Inward Supply)"}
              </span>
            </div>
          </div>

          {/* Proforma Exclusion Banner */}
          {current.isProformaExcluded && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-theme-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                This entry is marked as an unbilled proforma invoice / quotation
                and is excluded from statutory GSTR-1 and GSTR-3B filings.
              </span>
            </div>
          )}

          {/* Section 1: Filing & Entity Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-gray-200/80 p-3.5 dark:border-gray-800 space-y-1">
              <span className="text-theme-xs text-gray-500 uppercase font-semibold">
                Counterparty GSTIN
              </span>
              <div className="text-base font-bold text-gray-900 dark:text-white">
                {current.gstin}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200/80 p-3.5 dark:border-gray-800 space-y-1">
              <span className="text-theme-xs text-gray-500 uppercase font-semibold">
                Tax Period
              </span>
              <div className="text-base font-bold text-gray-900 dark:text-white">
                {current.period}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200/80 p-3.5 dark:border-gray-800 space-y-1">
              <span className="text-theme-xs text-gray-500 uppercase font-semibold">
                Source Reference & Type
              </span>
              <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-blue-600" />
                <span>{current.sourceReference}</span>
                <span className="text-theme-xs font-normal text-gray-500">
                  ({current.sourceType})
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200/80 p-3.5 dark:border-gray-800 space-y-1">
              <span className="text-theme-xs text-gray-500 uppercase font-semibold">
                HSN / SAC Code
              </span>
              <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Hash className="h-4 w-4 text-gray-400" />
                <span>{current.hsnSacCode || "Not Classified"}</span>
              </div>
            </div>
          </div>

          {/* Section: General Ledger (GL) Integration & Audit Status */}
          <div className="flex flex-col gap-2 rounded-xl border border-gray-200/80 p-4 dark:border-gray-800 bg-white dark:bg-gray-900/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-sky-400">
                  <FileText className="h-4 w-4" />
                </div>
                <span className="text-theme-sm font-bold text-gray-900 dark:text-white">
                  General Ledger (GL) Status
                </span>
              </div>

              {current.sourceType === "MANUAL" ? (
                <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-theme-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  Registry Only (Statutory)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-theme-xs font-semibold text-[#1769F5] border border-blue-200/50 dark:bg-blue-950/60 dark:text-sky-300">
                  <Check className="h-3.5 w-3.5" />
                  GL Linked ({current.sourceType})
                </span>
              )}
            </div>

            <p className="text-theme-xs text-gray-600 dark:text-gray-400">
              {current.sourceType === "MANUAL"
                ? "This entry was recorded directly into the statutory GST tax register. In accordance with internal controls, manual GST registry entries do not post double-entry vouchers to the General Ledger."
                : `Synchronized with Finance General Ledger from ${current.sourceType}. Accounting debit/credit entries are posted under reference '${current.sourceReference}'.`}
            </p>

            {current.sourceType !== "MANUAL" && (
              <div className="pt-1">
                <Link
                  href={`/finance/journal-entries?search=${encodeURIComponent(current.sourceReference)}`}
                  className="inline-flex items-center gap-1.5 text-theme-xs font-semibold text-[#1769F5] hover:underline dark:text-sky-400"
                >
                  <span>
                    View Journal Voucher for {current.sourceReference}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>

          {/* Section 2: Financial Breakdown */}
          <div className="rounded-xl border border-gray-200/80 p-4 dark:border-gray-800 space-y-3">
            <h4 className="text-theme-xs font-bold text-gray-500 uppercase tracking-wider">
              Tax Valuation Breakdown
            </h4>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-theme-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Taxable Base Value:
                </span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {formatMoney(current.taxableAmount)}
                </span>
              </div>

              <div className="flex justify-between items-center text-theme-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Central Tax (CGST {current.cgstRate}%):
                </span>
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {formatMoney(current.cgstAmount)}
                </span>
              </div>

              <div className="flex justify-between items-center text-theme-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  State/UT Tax (SGST {current.sgstRate}%):
                </span>
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {formatMoney(current.sgstAmount)}
                </span>
              </div>

              <div className="flex justify-between items-center text-theme-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Integrated Tax (IGST {current.igstRate}%):
                </span>
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {formatMoney(current.igstAmount)}
                </span>
              </div>

              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center text-theme-sm font-bold">
                <span className="text-gray-900 dark:text-white">
                  Total GST Tax Amount:
                </span>
                <span className="text-[#1769F5] dark:text-sky-400">
                  {formatMoney(current.totalTaxAmount)}
                </span>
              </div>

              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center text-base font-extrabold">
                <span className="text-gray-900 dark:text-white">
                  Total Invoice Value:
                </span>
                <span className="text-gray-900 dark:text-white">
                  {formatMoney(totalValue)}
                </span>
              </div>
            </div>
          </div>

          {/* Creator & Timestamps */}
          <div className="flex flex-wrap justify-between items-center gap-2 text-theme-xs text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              <span>Created by User #{current.createdBy ?? "System"}</span>
            </div>
            <span>Recorded: {formatDateTime(current.createdAt)}</span>
            <span>Last Updated: {formatDateTime(current.updatedAt)}</span>
          </div>

          {/* Actions */}
          <div className="flex justify-end pt-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
