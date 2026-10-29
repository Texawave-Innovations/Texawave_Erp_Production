"use client";

import { useMemo, useState } from "react";
import type {
  FinanceExpense,
  RecordExpensePaymentInput,
} from "@texawave-erp/api-types";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
  Select,
  Textarea,
} from "@texawave-erp/ui-kit";
import { Check, Wallet } from "lucide-react";
import { useMasterListItems } from "@/features/finance-settings/hooks";
import { formatMoney } from "../../shared/format";
import { useActiveBankAccounts } from "../hooks";
import { payExpenseSchema } from "../schema";

export interface PayExpenseDialogProps {
  expense: FinanceExpense | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (id: number, values: RecordExpensePaymentInput) => Promise<void>;
}

function PayExpenseForm({
  expense,
  onClose,
  onSubmit,
}: {
  expense: FinanceExpense;
  onClose: () => void;
  onSubmit: (id: number, values: RecordExpensePaymentInput) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);

  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentModeId, setPaymentModeId] = useState<number | "">(
    expense.paymentModeId ?? "",
  );
  const [bankAccountId, setBankAccountId] = useState<number | "">(
    expense.bankAccountId ?? "",
  );
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const paymentModesQuery = useMasterListItems({
    category: "payment_mode",
    limit: 100,
  });
  const bankAccountsQuery = useActiveBankAccounts();

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
      paymentDate,
      paymentModeId: paymentModeId ? Number(paymentModeId) : undefined,
      bankAccountId: bankAccountId ? Number(bankAccountId) : undefined,
      notes: notes.trim() || undefined,
    };

    const parsed = payExpenseSchema.safeParse(rawInput);
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

    const payload: RecordExpensePaymentInput = {
      ...(parsed.data.paymentDate
        ? { paymentDate: parsed.data.paymentDate }
        : {}),
      ...(parsed.data.paymentModeId !== undefined
        ? { paymentModeId: parsed.data.paymentModeId }
        : {}),
      ...(parsed.data.bankAccountId !== undefined
        ? { bankAccountId: parsed.data.bankAccountId }
        : {}),
      ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
    };

    setSubmitting(true);
    try {
      await onSubmit(expense.id, payload);
      onClose();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to disburse payment",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 text-theme-sm relative focus-within:z-30">
      {submitError && (
        <Alert variant="error" title="Payment Error">
          {submitError}
        </Alert>
      )}

      {/* Expense Info Card */}
      <div className="rounded-xl bg-blue-50/70 p-4 border border-blue-100/70 dark:bg-blue-950/20 dark:border-blue-900/30">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              Expense #{expense.expenseNumber}
            </span>
            <h3 className="text-theme-base font-bold text-gray-900 dark:text-white">
              {expense.vendorName ||
                expense.expenseType?.value ||
                "Operating Expense"}
            </h3>
          </div>
          <div className="text-right">
            <span className="text-theme-xs text-gray-500 dark:text-gray-400 block">
              Net Amount to Disburse
            </span>
            <span className="text-theme-lg font-bold text-blue-700 dark:text-sky-400">
              {formatMoney(expense.netAmount || expense.amount)}
            </span>
          </div>
        </div>
      </div>

      {/* Row 1: Payment Date & Payment Mode */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="Disbursement Date"
          required
          error={errors.paymentDate}
          hint="Settlement date"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="date"
              value={paymentDate}
              max={today}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          )}
        </FormField>

        <FormField
          label="Payment Mode"
          error={errors.paymentModeId}
          hint="Cash, Bank Transfer, NEFT, UPI"
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

      {/* Row 2: Paid Through Bank Account */}
      <FormField
        label="Disbursing Bank Account"
        error={errors.bankAccountId}
        hint="Company bank account debited"
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

      {/* Row 3: Transaction / Settlement Notes */}
      <FormField
        label="Settlement Notes / UTR / Reference"
        error={errors.notes}
        hint="Optional payment reference or bank remarks"
      >
        {() => (
          <Textarea
            value={notes}
            rows={2}
            placeholder="e.g. Paid via NEFT UTR #..."
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
          Disburse & Post to GL
        </Button>
      </div>
    </div>
  );
}

export function PayExpenseDialog({
  expense,
  open,
  onClose,
  onSubmit,
}: PayExpenseDialogProps) {
  if (!open || !expense) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/50">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <span className="text-theme-lg font-bold text-gray-900 dark:text-white">
              Disburse Expense Payment
            </span>
            <p className="text-theme-xs font-normal text-gray-500 dark:text-gray-400">
              Record bank/cash disbursement and atomically post the General
              Ledger journal entry
            </p>
          </div>
        </div>
      }
      size="xl"
    >
      <PayExpenseForm expense={expense} onClose={onClose} onSubmit={onSubmit} />
    </Dialog>
  );
}
