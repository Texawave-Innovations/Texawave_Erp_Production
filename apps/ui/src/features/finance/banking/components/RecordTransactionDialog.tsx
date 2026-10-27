"use client";

import { useMemo, useState } from "react";
import type {
  CreateFinanceBankTransactionInput,
  FinanceBankAccount,
  FinanceBankTransactionType,
} from "@texawave-erp/api-types";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
  Select,
  useToast,
} from "@texawave-erp/ui-kit";
import { ArrowLeftRight, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useAccounts } from "@/features/finance/coa/hooks";
import { useRecordBankTransaction } from "../hooks";
import { createBankTransactionSchema } from "../schema";

export interface RecordTransactionDialogProps {
  open: boolean;
  onClose: () => void;
  bankAccounts: FinanceBankAccount[];
  defaultBankAccountId?: number | undefined;
  onSuccess?: (() => void) | undefined;
}

export function RecordTransactionDialog({
  open,
  onClose,
  bankAccounts,
  defaultBankAccountId,
  onSuccess,
}: RecordTransactionDialogProps) {
  const { toast } = useToast();
  const recordMutation = useRecordBankTransaction();
  const today = new Date().toISOString().slice(0, 10);

  const [bankAccountId, setBankAccountId] = useState<number | "">(
    defaultBankAccountId ?? bankAccounts[0]?.id ?? "",
  );
  const [transactionDate, setTransactionDate] = useState(today);
  const [transactionType, setTransactionType] =
    useState<FinanceBankTransactionType>("DEBIT");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [counterGlAccountId, setCounterGlAccountId] = useState<number | "">("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Query Chart of Accounts for optional double-entry GL offset
  const accountsQuery = useAccounts({
    isActive: true,
    limit: 150,
  });

  const coaAccounts = useMemo(() => {
    return accountsQuery.data?.data ?? [];
  }, [accountsQuery.data?.data]);

  const resetForm = () => {
    setBankAccountId(defaultBankAccountId ?? bankAccounts[0]?.id ?? "");
    setTransactionDate(today);
    setTransactionType("DEBIT");
    setAmount("");
    setDescription("");
    setReferenceNumber("");
    setCounterGlAccountId("");
    setSubmitError(null);
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setErrors({});

    const rawAmount = Number(amount);

    const parseResult = createBankTransactionSchema.safeParse({
      bankAccountId: bankAccountId ? Number(bankAccountId) : undefined,
      transactionDate,
      transactionType,
      amount: rawAmount,
      description,
      referenceNumber: referenceNumber || null,
      counterGlAccountId: counterGlAccountId
        ? Number(counterGlAccountId)
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

    const payload: CreateFinanceBankTransactionInput = {
      bankAccountId: parseResult.data.bankAccountId,
      transactionDate: parseResult.data.transactionDate,
      transactionType: parseResult.data.transactionType,
      amount: parseResult.data.amount,
      description: parseResult.data.description,
      ...(parseResult.data.referenceNumber
        ? { referenceNumber: parseResult.data.referenceNumber }
        : {}),
      ...(parseResult.data.counterGlAccountId
        ? { counterGlAccountId: parseResult.data.counterGlAccountId }
        : {}),
    };

    setSubmitting(true);
    try {
      const created = await recordMutation.mutateAsync(payload);
      toast({
        title: `Transaction recorded: ${created.transactionType} of ₹${Number(created.amount).toLocaleString("en-IN")}`,
        variant: "success",
      });
      handleClose();
      onSuccess?.();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Failed to record bank transaction",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5 text-[#1769F5] dark:text-sky-400" />
          <span>Record Bank Transaction</span>
        </div>
      }
      size="2xl"
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4 text-theme-sm relative focus-within:z-30"
      >
        {submitError && (
          <Alert variant="error" title="Transaction Failed">
            {submitError}
          </Alert>
        )}

        {/* Row 1: Target Bank Account & Transaction Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Target Bank Account"
            required
            error={errors.bankAccountId}
          >
            {(fieldProps) => (
              <Select
                {...fieldProps}
                value={bankAccountId}
                onChange={(e) =>
                  setBankAccountId(e.target.value ? Number(e.target.value) : "")
                }
              >
                <option value="">Select Bank Account</option>
                {bankAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.accountName} ({acc.bankName} - {acc.accountNumber})
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <FormField
            label="Transaction Date"
            required
            error={errors.transactionDate}
            hint="Cannot be in the future"
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="date"
                max={today}
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
              />
            )}
          </FormField>
        </div>

        {/* Row 2: Transaction Type & Amount */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Transaction Direction"
            required
            error={errors.transactionType}
          >
            {() => (
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setTransactionType("CREDIT")}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-theme-sm font-semibold transition-all cursor-pointer ${
                    transactionType === "CREDIT"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300 ring-2 ring-emerald-500/20"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Credit (Inflow)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTransactionType("DEBIT")}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-theme-sm font-semibold transition-all cursor-pointer ${
                    transactionType === "DEBIT"
                      ? "border-amber-600 bg-amber-50 text-amber-700 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-300 ring-2 ring-amber-500/20"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  <ArrowUpRight className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span>Debit (Outflow)</span>
                </button>
              </div>
            )}
          </FormField>

          <FormField
            label="Transaction Amount"
            required
            error={errors.amount}
            hint="Amount in INR (must be positive)"
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            )}
          </FormField>
        </div>

        {/* Row 3: Description & Reference Number */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Description / Memo"
            required
            error={errors.description}
            hint="Details or statement narrative"
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                value={description}
                placeholder="e.g. Monthly bank interest earned / Wire charges"
                onChange={(e) => setDescription(e.target.value)}
              />
            )}
          </FormField>

          <FormField
            label="Reference / UTR / Cheque No."
            error={errors.referenceNumber}
            hint="Optional bank reference"
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                value={referenceNumber}
                placeholder="e.g. UTR123456789 or CHQ0045"
                onChange={(e) => setReferenceNumber(e.target.value)}
              />
            )}
          </FormField>
        </div>

        {/* Row 4: Optional Counter GL Account for automatic Journal Voucher */}
        <FormField
          label="Offset / Counter GL Account"
          error={errors.counterGlAccountId}
          hint="Optional: Posts automatic double-entry voucher (e.g. Bank Charges Expense or Interest Revenue)"
        >
          {(fieldProps) => (
            <Select
              {...fieldProps}
              value={counterGlAccountId}
              onChange={(e) =>
                setCounterGlAccountId(
                  e.target.value ? Number(e.target.value) : "",
                )
              }
            >
              <option value="">No GL offset voucher (Bank ledger only)</option>
              {coaAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  [{acc.accountType}] {acc.accountCode} — {acc.accountName}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        {/* Dialog Actions */}
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
            className="bg-[#1769F5] hover:bg-[#0a3271] text-white"
          >
            <ArrowLeftRight className="h-4 w-4 mr-1.5" />
            <span>{submitting ? "Posting..." : "Record Transaction"}</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
