"use client";

import { Button, Dialog } from "@texawave-erp/ui-kit";
import { Calendar, Check, FileText, Receipt, Tag, User, X } from "lucide-react";
import { EmployeeIdentity } from "@/features/hr/components/EmployeeIdentity";
import type { ExpenseClaimItem } from "../types";
import { ExpenseClaimStatusBadge } from "./ExpenseClaimStatusBadge";

export interface ExpenseClaimDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  claim: ExpenseClaimItem | null;
  employeeCode?: string | undefined;
  canDecide?: boolean;
  onDecide?: (
    claim: ExpenseClaimItem,
    decision: "APPROVED" | "REJECTED",
  ) => void;
  currentUserId?: number;
}

function formatIndianCurrency(amount: number): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `₹ ${amount.toFixed(2)}`;
  }
}

function formatExpenseDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(
      dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00Z`,
    );
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function ExpenseClaimDetailsDialog({
  open,
  onClose,
  claim,
  employeeCode,
  canDecide = false,
  onDecide,
}: ExpenseClaimDetailsDialogProps) {
  if (!claim) return null;

  const isPending = claim.status === "PENDING";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Expense Claim Details"
      size="lg"
    >
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">
            View complete information about this expense claim.
          </p>
        </div>

        {/* Amount & Type Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/40">
          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Expense Type
            </span>
            <div className="flex items-center gap-2 mt-1">
              <Tag className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              <span className="text-theme-sm font-semibold text-gray-900 dark:text-white/90">
                {claim.expenseType}
              </span>
            </div>
          </div>

          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Amount
            </span>
            <p className="text-theme-lg font-bold text-gray-900 dark:text-white/90 mt-0.5">
              {formatIndianCurrency(claim.amount)}
            </p>
          </div>
        </div>

        {/* Date & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Expense Date
            </span>
            <div className="flex items-center gap-2 mt-1.5">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-theme-sm text-gray-800 dark:text-gray-200">
                {formatExpenseDate(claim.expenseDate)}
              </span>
            </div>
          </div>

          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Status
            </span>
            <div className="mt-1">
              <ExpenseClaimStatusBadge status={claim.status} />
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
            Description
          </span>
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-theme-sm text-gray-800 dark:border-gray-800 dark:bg-gray-dark dark:text-gray-200 min-h-16">
            {claim.description}
          </div>
        </div>

        {/* Receipt Reference */}
        <div className="flex flex-col gap-1.5">
          <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
            Receipt Reference
          </span>
          <div className="flex items-center gap-2 text-theme-sm text-gray-800 dark:text-gray-200">
            <Receipt className="h-4 w-4 text-gray-400" />
            <span>{claim.receiptRef || "—"}</span>
          </div>
        </div>

        {/* Employee & Submission Details */}
        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3.5 dark:border-gray-800 dark:bg-gray-800/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center">
            <div>
              <span className="text-theme-xs text-gray-400 block mb-1">
                Claimant
              </span>
              <EmployeeIdentity
                name={claim.employee.fullName}
                code={employeeCode}
                size="sm"
              />
            </div>
            <div>
              <span className="text-theme-xs text-gray-400 block mb-1">
                Submitted On
              </span>
              <div className="flex items-center gap-1.5 text-theme-xs text-gray-600 dark:text-gray-300">
                <Calendar className="h-3.5 w-3.5 text-gray-400" />
                <span>{formatDateTime(claim.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Decision details if decided */}
        {claim.status !== "PENDING" &&
        (claim.decidedBy || claim.decisionNote) ? (
          <div className="rounded-xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-dark">
            <span className="text-theme-xs font-semibold text-gray-700 dark:text-gray-300 block mb-2">
              Decision Details
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-theme-xs text-gray-600 dark:text-gray-400 mb-2">
              {claim.decidedBy ? (
                <div>
                  Decided by:{" "}
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {claim.decidedBy.fullName}
                  </span>
                </div>
              ) : null}
              {claim.decidedAt ? (
                <div>
                  Decided on:{" "}
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {formatDateTime(claim.decidedAt)}
                  </span>
                </div>
              ) : null}
            </div>
            {claim.decisionNote ? (
              <div className="mt-2 text-theme-xs border-t border-gray-100 pt-2 dark:border-gray-800">
                <span className="text-gray-500 block mb-0.5">Note:</span>
                <span className="text-gray-800 dark:text-gray-200">
                  {claim.decisionNote}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-800">
          {canDecide && isPending && onDecide ? (
            <>
              <Button type="button" variant="secondary" onClick={onClose}>
                Close
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  onClose();
                  onDecide(claim, "REJECTED");
                }}
                className="inline-flex items-center gap-1.5"
              >
                <X className="h-4 w-4" />
                Reject
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onClose();
                  onDecide(claim, "APPROVED");
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                Approve
              </Button>
            </>
          ) : (
            <Button type="button" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
