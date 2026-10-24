"use client";

import { useMemo, useState } from "react";
import type { CreateFinanceExpenseInput } from "@texawave-erp/api-types";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
  Select,
  Textarea,
} from "@texawave-erp/ui-kit";
import { Check, Clock, Receipt } from "lucide-react";
import { useAccounts } from "@/features/finance/coa/hooks";
import { useMasterListItems } from "@/features/finance-settings/hooks";
import { formatMoney } from "../../shared/format";
import { useActiveBankAccounts } from "../hooks";
import { createExpenseSchema } from "../schema";

export interface AddExpenseDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CreateFinanceExpenseInput) => Promise<void>;
}

function AddExpenseForm({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (values: CreateFinanceExpenseInput) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);

  // Form State
  const [expenseDate, setExpenseDate] = useState(today);
  const [expenseTypeId, setExpenseTypeId] = useState<number | "">("");
  const [vendorName, setVendorName] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [taxAmount, setTaxAmount] = useState<number | "">(0);
  const [paymentModeId, setPaymentModeId] = useState<number | "">("");
  const [bankAccountId, setBankAccountId] = useState<number | "">("");
  const [glAccountId, setGlAccountId] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // External queries
  const expenseTypesQuery = useMasterListItems({
    category: "expense_type",
    limit: 100,
  });
  const paymentModesQuery = useMasterListItems({
    category: "payment_mode",
    limit: 100,
  });
  const bankAccountsQuery = useActiveBankAccounts();
  const accountsQuery = useAccounts({ limit: 100, accountType: "EXPENSE" });

  const expenseTypes = useMemo(
    () => expenseTypesQuery.data?.data ?? [],
    [expenseTypesQuery.data?.data],
  );

  const paymentModes = useMemo(
    () => paymentModesQuery.data?.data ?? [],
    [paymentModesQuery.data?.data],
  );

  const bankAccounts = useMemo(
    () => bankAccountsQuery.data ?? [],
    [bankAccountsQuery.data],
  );

  const glAccounts = useMemo(
    () => accountsQuery.data?.data ?? [],
    [accountsQuery.data?.data],
  );

  const effectiveExpenseTypeId =
    expenseTypeId || (expenseTypes.length > 0 ? expenseTypes[0]!.id : "");

  const numAmount = typeof amount === "number" ? amount : 0;
  const numTax = typeof taxAmount === "number" ? taxAmount : 0;
  const netTotal = numAmount + numTax;

  const handleSubmit = async (targetStatus: "PAID" | "DRAFT") => {
    setSubmitError(null);
    setErrors({});

    const rawInput = {
      expenseTypeId: Number(effectiveExpenseTypeId),
      expenseDate,
      amount: typeof amount === "number" ? amount : 0,
      taxAmount: typeof taxAmount === "number" ? taxAmount : 0,
      vendorName: vendorName.trim() || undefined,
      paymentModeId: paymentModeId ? Number(paymentModeId) : undefined,
      bankAccountId: bankAccountId ? Number(bankAccountId) : undefined,
      glAccountId: glAccountId ? Number(glAccountId) : undefined,
      notes: notes.trim() || undefined,
      receiptUrl: receiptUrl.trim() || undefined,
      status: targetStatus,
    };

    const parsed = createExpenseSchema.safeParse(rawInput);
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

    const payload: CreateFinanceExpenseInput = {
      expenseTypeId: parsed.data.expenseTypeId,
      expenseDate: parsed.data.expenseDate,
      amount: parsed.data.amount,
      ...(parsed.data.taxAmount !== undefined
        ? { taxAmount: parsed.data.taxAmount }
        : {}),
      ...(parsed.data.vendorName ? { vendorName: parsed.data.vendorName } : {}),
      ...(parsed.data.paymentModeId
        ? { paymentModeId: parsed.data.paymentModeId }
        : {}),
      ...(parsed.data.bankAccountId
        ? { bankAccountId: parsed.data.bankAccountId }
        : {}),
      ...(parsed.data.glAccountId
        ? { glAccountId: parsed.data.glAccountId }
        : {}),
      ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
      ...(parsed.data.receiptUrl ? { receiptUrl: parsed.data.receiptUrl } : {}),
      status: targetStatus,
    };

    setSubmitting(true);
    try {
      await onSubmit(payload);
      onClose();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to record expense",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 text-theme-sm relative focus-within:z-30">
      {submitError && (
        <Alert variant="error" title="Submission Error">
          {submitError}
        </Alert>
      )}

      {/* Row 1: Category & Incurred Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="Expense Category"
          required
          error={errors.expenseTypeId}
          hint="Type of business overhead"
        >
          {() => (
            <Select
              value={
                effectiveExpenseTypeId ? String(effectiveExpenseTypeId) : ""
              }
              onChange={(e) => setExpenseTypeId(Number(e.target.value))}
            >
              <option value="">Select Category</option>
              {expenseTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.value}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField
          label="Incurred Date"
          required
          error={errors.expenseDate}
          hint="Cannot be in the future"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="date"
              value={expenseDate}
              max={today}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          )}
        </FormField>
      </div>

      {/* Row 2: Vendor / Payee & GL Account */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="Vendor / Payee Name"
          error={errors.vendorName}
          hint="Merchant, supplier, or payee"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={vendorName}
              placeholder="e.g. Acme Office Supplies Ltd"
              onChange={(e) => setVendorName(e.target.value)}
            />
          )}
        </FormField>

        <FormField
          label="General Ledger Account"
          error={errors.glAccountId}
          hint="Chart of Accounts expense head"
        >
          {() => (
            <Select
              value={glAccountId ? String(glAccountId) : ""}
              onChange={(e) =>
                setGlAccountId(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">Default from Category / Settings</option>
              {glAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.accountCode} - {a.accountName}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </div>

      {/* Row 3: Subtotal Amount, Tax, and Calculated Net Total */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField
          label="Subtotal Amount (₹)"
          required
          error={errors.amount}
          hint="Base amount before tax"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              placeholder="0.00"
              onChange={(e) =>
                setAmount(e.target.value === "" ? "" : Number(e.target.value))
              }
            />
          )}
        </FormField>

        <FormField
          label="Tax / GST Amount (₹)"
          error={errors.taxAmount}
          hint="Applicable tax or 0"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="number"
              step="0.01"
              min="0"
              value={taxAmount}
              placeholder="0.00"
              onChange={(e) =>
                setTaxAmount(
                  e.target.value === "" ? "" : Number(e.target.value),
                )
              }
            />
          )}
        </FormField>

        <div className="flex flex-col justify-center rounded-xl bg-blue-50/70 p-3 border border-blue-100/70 dark:bg-blue-950/20 dark:border-blue-900/30">
          <span className="text-theme-xs font-semibold text-blue-900 dark:text-sky-300">
            Total Net Amount
          </span>
          <span className="text-theme-lg font-bold text-blue-700 dark:text-sky-400">
            {formatMoney(netTotal)}
          </span>
        </div>
      </div>

      {/* Row 4: Payment Mode & Disbursing Bank Account */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        <FormField
          label="Paid Through Bank Account"
          error={errors.bankAccountId}
          hint="Company account debited"
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
      </div>

      {/* Row 5: Receipt URL & Notes */}
      <div className="grid grid-cols-1 gap-4">
        <FormField
          label="Receipt / Bill Document URL"
          error={errors.receiptUrl}
          hint="Link to scanned invoice or receipt"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={receiptUrl}
              placeholder="https://..."
              onChange={(e) => setReceiptUrl(e.target.value)}
            />
          )}
        </FormField>

        <FormField
          label="Internal Notes / Description"
          error={errors.notes}
          hint="Detailed purpose of the expense"
        >
          {() => (
            <Textarea
              value={notes}
              rows={2}
              placeholder="Add expense details..."
              onChange={(e) => setNotes(e.target.value)}
            />
          )}
        </FormField>
      </div>

      {/* Modal Actions */}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        <Button variant="outline" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="secondary"
          onClick={() => void handleSubmit("DRAFT")}
          disabled={submitting}
        >
          <Clock className="h-4 w-4 mr-1.5" />
          Save as Draft
        </Button>
        <Button
          variant="primary"
          onClick={() => void handleSubmit("PAID")}
          disabled={submitting}
        >
          <Check className="h-4 w-4 mr-1.5" />
          Record & Disburse
        </Button>
      </div>
    </div>
  );
}

export function AddExpenseDialog({
  open,
  onClose,
  onSubmit,
}: AddExpenseDialogProps) {
  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/50">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <span className="text-theme-lg font-bold text-gray-900 dark:text-white">
              Add Operating Expense
            </span>
            <p className="text-theme-xs font-normal text-gray-500 dark:text-gray-400">
              Record a new business expense overhead with optional immediate
              General Ledger posting
            </p>
          </div>
        </div>
      }
      size="2xl"
    >
      <AddExpenseForm onClose={onClose} onSubmit={onSubmit} />
    </Dialog>
  );
}
