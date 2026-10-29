"use client";

import type { FinanceBankAccount } from "@texawave-erp/api-types";
import { Button, Dialog, StatusBadge } from "@texawave-erp/ui-kit";
import { Building2, Landmark, Pencil } from "lucide-react";
import { formatDate, formatMoney } from "../../shared/format";

export interface BankAccountDetailDialogProps {
  open: boolean;
  onClose: () => void;
  account: FinanceBankAccount | null;
  onEdit?: ((account: FinanceBankAccount) => void) | undefined;
}

export function BankAccountDetailDialog({
  open,
  onClose,
  account,
  onEdit,
}: BankAccountDetailDialogProps) {
  if (!account) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-[#1769F5] dark:text-sky-400" />
          <span>Bank Account Overview</span>
        </div>
      }
      size="xl"
    >
      <div className="space-y-6 text-theme-sm relative focus-within:z-30">
        {/* Hero Card */}
        <div className="rounded-2xl border border-blue-200/80 bg-linear-to-br from-blue-50/80 via-white to-sky-50/40 p-5 shadow-xs dark:border-blue-900/50 dark:from-blue-950/30 dark:via-gray-900 dark:to-sky-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-xs">
                <Building2 className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {account.accountName}
                </h3>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {account.bankName} · {account.accountNumber}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:items-end">
              <span className="text-theme-xs font-semibold text-gray-500 uppercase dark:text-gray-400">
                Current Balance
              </span>
              <span className="text-2xl font-black text-gray-900 dark:text-white">
                {formatMoney(account.currentBalance, account.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-gray-200/80 p-4 dark:border-gray-800 dark:bg-gray-900/50">
          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Account Number
            </span>
            <p className="font-semibold text-gray-900 dark:text-white">
              {account.accountNumber}
            </p>
          </div>

          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Account Type
            </span>
            <div className="mt-0.5">
              <StatusBadge label={account.accountType} colorToken="brand" />
            </div>
          </div>

          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Bank Name
            </span>
            <p className="font-semibold text-gray-900 dark:text-white">
              {account.bankName}
            </p>
          </div>

          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              IFSC / Routing Code
            </span>
            <p className="font-semibold text-gray-900 dark:text-white">
              {account.ifscCode}
            </p>
          </div>

          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Branch Name
            </span>
            <p className="font-semibold text-gray-900 dark:text-white">
              {account.branchName || "—"}
            </p>
          </div>

          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Opening Balance
            </span>
            <p className="font-semibold text-gray-900 dark:text-white">
              {formatMoney(account.openingBalance, account.currency)}
            </p>
          </div>

          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Status
            </span>
            <div className="mt-0.5">
              <StatusBadge
                label={account.isActive ? "Active" : "Archived"}
                colorToken={account.isActive ? "success" : "gray"}
              />
            </div>
          </div>

          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Linked GL Account
            </span>
            <p className="font-semibold text-gray-900 dark:text-white">
              {account.glAccount
                ? `[${account.glAccount.accountCode}] ${account.glAccount.accountName}`
                : "No GL Account Linked"}
            </p>
          </div>

          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Onboarded At
            </span>
            <p className="font-medium text-gray-700 dark:text-gray-300">
              {formatDate(account.createdAt)}
            </p>
          </div>

          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Last Updated
            </span>
            <p className="font-medium text-gray-700 dark:text-gray-300">
              {formatDate(account.updatedAt)}
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {onEdit && (
            <Button
              onClick={() => {
                onClose();
                onEdit(account);
              }}
              className="bg-[#1769F5] hover:bg-[#0a3271] text-white"
            >
              <Pencil className="h-4 w-4 mr-1.5" />
              <span>Edit Account</span>
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
