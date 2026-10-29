"use client";

import { useMemo, useState } from "react";
import type { CreateExpenseFromClaimInput } from "@texawave-erp/api-types";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Select,
  Textarea,
} from "@texawave-erp/ui-kit";
import { ArrowRight, Check } from "lucide-react";
import { useAccounts } from "@/features/finance/coa/hooks";
import { useMasterListItems } from "@/features/finance-settings/hooks";
import type { ExpenseClaimItem } from "@/features/hr/expense-approvals/types";
import { formatDate, formatMoney } from "../../shared/format";
import { useActiveBankAccounts } from "../hooks";
import { createExpenseFromClaimSchema } from "../schema";

export interface ConvertClaimDialogProps {
  claim: ExpenseClaimItem | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (
    claimId: number,
    values: CreateExpenseFromClaimInput,
  ) => Promise<void>;
}

function ConvertClaimForm({
  claim,
  onClose,
  onSubmit,
}: {
  claim: ExpenseClaimItem;
  onClose: () => void;
  onSubmit: (
    claimId: number,
    values: CreateExpenseFromClaimInput,
  ) => Promise<void>;
}) {
  const [glAccountId, setGlAccountId] = useState<number | "">("");
  const [paymentModeId, setPaymentModeId] = useState<number | "">("");
  const [bankAccountId, setBankAccountId] = useState<number | "">("");
  const [notes, setNotes] = useState(
    `Reimbursement for claim #${claim.id}: ${claim.description || ""}`,
  );

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const accountsQuery = useAccounts({ limit: 100, accountType: "EXPENSE" });
  const paymentModesQuery = useMasterListItems({
    category: "payment_mode",
    limit: 100,
  });
  const bankAccountsQuery = useActiveBankAccounts();

  const glAccounts = useMemo(
    () => accountsQuery.data?.data ?? [],
    [accountsQuery.data?.data],
  );

  const paymentModes = useMemo(
    () => paymentModesQuery.data?.data ?? [],
    [paymentModesQuery.data?.data],
  );

  const bankAccounts = useMemo(
    () => bankAccountsQuery.data ?? [],
    [bankAccountsQuery.data],
  );

  const handleSubmit = async () => {
    setSubmitError(null);
    setErrors({});

    const rawInput = {
      glAccountId: glAccountId ? Number(glAccountId) : undefined,
      paymentModeId: paymentModeId ? Number(paymentModeId) : undefined,
      bankAccountId: bankAccountId ? Number(bankAccountId) : undefined,
      notes: notes.trim() || undefined,
    };

    const parsed = createExpenseFromClaimSchema.safeParse(rawInput);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const pathKey = issue.path[0] as string;
        if (!fieldErrors[pathKey]) {
          fieldErrors[pathKey] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    const payload: CreateExpenseFromClaimInput = {
      ...(parsed.data.glAccountId
        ? { glAccountId: parsed.data.glAccountId }
        : {}),
      ...(parsed.data.paymentModeId
        ? { paymentModeId: parsed.data.paymentModeId }
        : {}),
      ...(parsed.data.bankAccountId
        ? { bankAccountId: parsed.data.bankAccountId }
        : {}),
      ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
    };

    setSubmitting(true);
    try {
      await onSubmit(claim.id, payload);
      onClose();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to convert claim",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 text-theme-sm relative focus-within:z-30">
      {submitError && (
        <Alert variant="error" title="Conversion Error">
          {submitError}
        </Alert>
      )}

      {/* Claim Summary Card */}
      <div className="rounded-xl bg-blue-50/70 p-4 border border-blue-100/70 dark:bg-blue-950/20 dark:border-blue-900/30">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-theme-xs">
          <div>
            <span className="text-gray-500 dark:text-gray-400 block">
              Claim ID
            </span>
            <span className="font-bold text-gray-900 dark:text-white">
              #{claim.id}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400 block">
              Employee
            </span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {claim.employee.fullName}
            </span>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400 block">
              Category & Date
            </span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {claim.expenseType} ({formatDate(claim.expenseDate)})
            </span>
          </div>
          <div className="text-right">
            <span className="text-gray-500 dark:text-gray-400 block">
              Approved Amount
            </span>
            <span className="text-theme-sm font-bold text-blue-700 dark:text-sky-400">
              {formatMoney(claim.amount)}
            </span>
          </div>
        </div>

        {claim.description && (
          <div className="mt-2.5 pt-2 border-t border-blue-100/60 dark:border-blue-900/40 text-theme-xs text-gray-600 dark:text-gray-300">
            <span className="font-semibold">Description:</span>{" "}
            {claim.description}
          </div>
        )}
      </div>

      {/* Row 1: GL Account & Payment Mode */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="General Ledger Account"
          error={errors.glAccountId}
          hint="Expense head to charge reimbursement"
        >
          {() => (
            <Select
              value={glAccountId ? String(glAccountId) : ""}
              onChange={(e) =>
                setGlAccountId(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">Auto-resolve from Category</option>
              {glAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountCode} - {a.accountName}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField
          label="Payment Mode"
          error={errors.paymentModeId}
          hint="Disbursement channel"
        >
          {() => (
            <Select
              value={paymentModeId ? String(paymentModeId) : ""}
              onChange={(e) =>
                setPaymentModeId(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">Select Payment Mode</option>
              {paymentModes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.value}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </div>

      {/* Row 2: Disbursing Bank Account */}
      <FormField
        label="Paid Through Bank Account"
        error={errors.bankAccountId}
        hint="Company bank account used for reimbursement"
      >
        {() => (
          <Select
            value={bankAccountId ? String(bankAccountId) : ""}
            onChange={(e) =>
              setBankAccountId(e.target.value ? Number(e.target.value) : "")
            }
          >
            <option value="">Select Bank Account</option>
            {bankAccounts.map((b) => (
              <option key={b.id} value={b.id}>
                {b.bankName} - {b.accountName} ({b.accountNumber.slice(-4)})
              </option>
            ))}
          </Select>
        )}
      </FormField>

      {/* Row 3: Notes */}
      <FormField
        label="Finance Notes / Description"
        error={errors.notes}
        hint="Accounting remarks"
      >
        {() => (
          <Textarea
            value={notes}
            rows={2}
            onChange={(e) => setNotes(e.target.value)}
          />
        )}
      </FormField>

      {/* Modal Actions */}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        <Button variant="outline" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => void handleSubmit()}
          disabled={submitting}
        >
          <Check className="h-4 w-4 mr-1.5" />
          Convert to Finance Expense
        </Button>
      </div>
    </div>
  );
}

export function ConvertClaimDialog({
  claim,
  open,
  onClose,
  onSubmit,
}: ConvertClaimDialogProps) {
  if (!open || !claim) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/50">
            <ArrowRight className="h-5 w-5" />
          </div>
          <div>
            <span className="text-theme-lg font-bold text-gray-900 dark:text-white">
              Convert Claim #{claim.id} to Finance Expense
            </span>
            <p className="text-theme-xs font-normal text-gray-500 dark:text-gray-400">
              Create a finance operating expense voucher for this approved HR
              employee claim
            </p>
          </div>
        </div>
      }
      size="xl"
    >
      <ConvertClaimForm claim={claim} onClose={onClose} onSubmit={onSubmit} />
    </Dialog>
  );
}
