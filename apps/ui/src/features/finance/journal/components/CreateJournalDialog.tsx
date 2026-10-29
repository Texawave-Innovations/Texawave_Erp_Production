"use client";

import { useId, useMemo, useState } from "react";
import type {
  CreateFinanceJournalEntryInput,
  FinanceAccount,
  FinanceJournalEntryType,
} from "@texawave-erp/api-types";
import { FINANCE_JOURNAL_ENTRY_TYPES } from "@texawave-erp/api-types";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
  Select,
  Textarea,
} from "@texawave-erp/ui-kit";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Plus,
  Scale,
  Trash2,
} from "lucide-react";
import { formatMoney } from "../../shared/format";
import { AccountBadge } from "../../../finance/coa/components/AccountBadge";
import { createJournalEntrySchema } from "../schema";

export interface CreateJournalDialogProps {
  open: boolean;
  onClose: () => void;
  accounts: FinanceAccount[];
  onSubmit: (values: CreateFinanceJournalEntryInput) => Promise<void>;
}

interface EditableLine {
  tempId: string;
  accountId: number;
  debit: number;
  credit: number;
  description: string;
}

function CreateJournalForm({
  accounts,
  onClose,
  onSubmit,
}: {
  accounts: FinanceAccount[];
  onClose: () => void;
  onSubmit: (values: CreateFinanceJournalEntryInput) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const line1Id = useId();
  const line2Id = useId();

  const [entryDate, setEntryDate] = useState(today);
  const [entryType, setEntryType] = useState<FinanceJournalEntryType>("MANUAL");
  const [narration, setNarration] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");

  const [lines, setLines] = useState<EditableLine[]>([
    {
      tempId: `line-${line1Id}-1`,
      accountId: accounts[0]?.id ?? 0,
      debit: 0,
      credit: 0,
      description: "",
    },
    {
      tempId: `line-${line2Id}-2`,
      accountId: accounts[1]?.id ?? 0,
      debit: 0,
      credit: 0,
      description: "",
    },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Account lookup dictionary for fast classification resolution
  const accountMap = useMemo(() => {
    const map = new Map<number, FinanceAccount>();
    for (const acc of accounts) {
      map.set(acc.id, acc);
    }
    return map;
  }, [accounts]);

  // Real-time double-entry totals calculation
  const { totalDebit, totalCredit, difference, isBalanced } = useMemo(() => {
    let d = 0;
    let c = 0;
    for (const line of lines) {
      d += Number(line.debit || 0);
      c += Number(line.credit || 0);
    }
    const roundedD = Math.round(d * 100) / 100;
    const roundedC = Math.round(c * 100) / 100;
    const diff = Math.round(Math.abs(roundedD - roundedC) * 100) / 100;
    return {
      totalDebit: roundedD,
      totalCredit: roundedC,
      difference: diff,
      isBalanced: roundedD > 0 && diff === 0,
    };
  }, [lines]);

  const handleLineChange = (
    tempId: string,
    field: keyof EditableLine,
    value: unknown,
  ) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.tempId !== tempId) return line;

        if (field === "debit") {
          const num = Math.max(0, Number(value || 0));
          // If debit has value, clear credit to enforce single-column line entry
          return { ...line, debit: num, credit: num > 0 ? 0 : line.credit };
        }
        if (field === "credit") {
          const num = Math.max(0, Number(value || 0));
          // If credit has value, clear debit to enforce single-column line entry
          return { ...line, credit: num, debit: num > 0 ? 0 : line.debit };
        }
        return { ...line, [field]: value };
      }),
    );
  };

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        tempId: `line-${Date.now()}-${prev.length + 1}`,
        accountId: accounts[0]?.id ?? 0,
        debit: 0,
        credit: 0,
        description: "",
      },
    ]);
  };

  const handleRemoveLine = (tempId: string) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((l) => l.tempId !== tempId));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const payload = {
      entryDate,
      entryType,
      narration: narration.trim(),
      referenceNumber: referenceNumber ? referenceNumber.trim() : undefined,
      lines: lines.map((l) => ({
        accountId: Number(l.accountId),
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
        description: l.description ? l.description.trim() : null,
      })),
    };

    const parsed = createJournalEntrySchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await onSubmit(payload);
      onClose();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Failed to record journal voucher. Please verify all lines and balances.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {submitError ? (
        <Alert variant="error" title="Error Posting Voucher">
          {submitError}
        </Alert>
      ) : null}

      {/* Double-Entry Guidance Card */}
      <div className="rounded-xl border border-blue-200/80 bg-blue-50/60 p-3.5 dark:border-blue-900/50 dark:bg-blue-950/30 text-theme-xs">
        <div className="flex items-start gap-2.5">
          <Scale className="h-4 w-4 shrink-0 text-blue-600 dark:text-sky-400 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-blue-950 dark:text-blue-100">
              Double-Entry Rule Invariant
            </span>
            <p className="text-blue-900/80 dark:text-blue-200/80 leading-relaxed">
              Every journal voucher requires at least two lines where Total
              Debits equal Total Credits (sum of debits = sum of credits). For
              each row, select an account and specify either a debit or credit
              amount.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 relative focus-within:z-30">
        <FormField
          label="Posting Date"
          required
          error={errors.entryDate}
          hint="Accounting transaction effective date"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>

        <FormField
          label="Entry Type"
          required
          error={errors.entryType}
          hint="Voucher classification"
        >
          {(fieldProps) => (
            <Select
              {...fieldProps}
              value={entryType}
              onChange={(e) =>
                setEntryType(e.target.value as FinanceJournalEntryType)
              }
              disabled={submitting}
            >
              {FINANCE_JOURNAL_ENTRY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField
          label="Reference / Document #"
          error={errors.referenceNumber}
          hint="External invoice, bill, or receipt #"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              placeholder="e.g. INV-9021"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              disabled={submitting}
              autoComplete="off"
            />
          )}
        </FormField>
      </div>

      <FormField
        label="Narration / Business Purpose"
        required
        error={errors.narration}
        hint="Clear explanation of the transaction reason"
      >
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            placeholder="e.g. Accrual of monthly software infrastructure expenses..."
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            disabled={submitting}
            rows={2}
          />
        )}
      </FormField>

      {/* Double-Entry Lines Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-blue-600 dark:text-sky-400" />
            <span className="text-theme-sm font-semibold text-gray-900 dark:text-white">
              Double-Entry Ledger Lines
            </span>
          </div>
          <span className="text-theme-xs text-gray-500 dark:text-gray-400">
            Minimum 2 lines required (Debits = Credits)
          </span>
        </div>

        {errors.lines ? (
          <p className="text-theme-xs font-medium text-rose-600 dark:text-rose-400">
            {errors.lines}
          </p>
        ) : null}

        <div className="rounded-xl border border-gray-200/90 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/40 p-3 flex flex-col gap-2.5">
          <div className="grid grid-cols-12 gap-2 text-theme-xs font-semibold text-gray-600 dark:text-gray-400 px-1">
            <span className="col-span-5">Account & Classification</span>
            <span className="col-span-3">Description / Line Memo</span>
            <span className="col-span-2 text-right">Debit</span>
            <span className="col-span-2 text-right">Credit</span>
          </div>

          {lines.map((line, idx) => {
            const selectedAccount = accountMap.get(line.accountId);
            return (
              <div
                key={line.tempId}
                className="grid grid-cols-12 gap-2 items-start bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200/80 dark:border-gray-800 relative focus-within:z-30"
              >
                <div className="col-span-5 flex flex-col gap-1">
                  <Select
                    value={String(line.accountId)}
                    onChange={(e) =>
                      handleLineChange(
                        line.tempId,
                        "accountId",
                        Number(e.target.value),
                      )
                    }
                    disabled={submitting}
                    aria-label={`Account for line ${idx + 1}`}
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={String(acc.id)}>
                        [{acc.accountCode}] {acc.accountName} ({acc.accountType}
                        )
                      </option>
                    ))}
                  </Select>
                  {selectedAccount ? (
                    <div className="flex items-center gap-1.5 px-0.5">
                      <AccountBadge
                        type={selectedAccount.accountType}
                        className="text-[10px] py-0.5 px-1.5"
                      />
                      <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                        Normal:{" "}
                        {selectedAccount.accountType === "ASSET" ||
                        selectedAccount.accountType === "EXPENSE"
                          ? "Debit"
                          : "Credit"}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="col-span-3">
                  <Input
                    placeholder="Line memo (optional)..."
                    value={line.description}
                    onChange={(e) =>
                      handleLineChange(
                        line.tempId,
                        "description",
                        e.target.value,
                      )
                    }
                    disabled={submitting}
                    aria-label={`Description for line ${idx + 1}`}
                  />
                </div>

                <div className="col-span-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="text-right font-medium"
                    value={line.debit === 0 ? "" : line.debit}
                    onChange={(e) =>
                      handleLineChange(line.tempId, "debit", e.target.value)
                    }
                    disabled={submitting}
                    aria-label={`Debit amount for line ${idx + 1}`}
                  />
                </div>

                <div className="col-span-2 flex items-center gap-1.5">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="text-right font-medium flex-1"
                    value={line.credit === 0 ? "" : line.credit}
                    onChange={(e) =>
                      handleLineChange(line.tempId, "credit", e.target.value)
                    }
                    disabled={submitting}
                    aria-label={`Credit amount for line ${idx + 1}`}
                  />

                  {lines.length > 2 ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveLine(line.tempId)}
                      disabled={submitting}
                      className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40"
                      title="Remove line"
                      aria-label={`Remove line ${idx + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="w-7 shrink-0" />
                  )}
                </div>
              </div>
            );
          })}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddLine}
            disabled={submitting}
            className="self-start gap-2 border-dashed border-blue-300 dark:border-blue-700 hover:border-blue-500 text-blue-700 dark:text-sky-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/40 mt-1"
          >
            <Plus className="h-4 w-4" />
            <span>Add Journal Line</span>
          </Button>

          {/* Balanced Totals Summary Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-3.5 mt-2 border-t border-gray-200 dark:border-gray-800">
            <div className="flex items-center gap-2">
              {isBalanced ? (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-theme-xs font-semibold border border-emerald-200/80 dark:border-emerald-900/50">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>Voucher is Balanced (Debits equal Credits)</span>
                </div>
              ) : difference > 0 ? (
                <div className="flex flex-col gap-0.5 rounded-lg bg-amber-50 px-3 py-1.5 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-theme-xs font-semibold border border-amber-200/80 dark:border-amber-900/50">
                  <div className="flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>Out of balance by {formatMoney(difference)}</span>
                  </div>
                  <span className="text-[11px] font-normal text-amber-700 dark:text-amber-300 pl-5.5">
                    {totalDebit > totalCredit
                      ? `Add ${formatMoney(difference)} to Credit to balance`
                      : `Add ${formatMoney(difference)} to Debit to balance`}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 text-theme-xs">
                  <Info className="h-4 w-4 shrink-0 text-blue-500" />
                  <span>
                    Enter debit and credit amounts for at least two accounts
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-5 text-theme-sm font-semibold">
              <div className="flex flex-col items-end">
                <span className="text-gray-500 dark:text-gray-400 text-[11px] font-medium">
                  Total Debit
                </span>
                <span className="text-gray-900 dark:text-white">
                  {formatMoney(totalDebit)}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-gray-500 dark:text-gray-400 text-[11px] font-medium">
                  Total Credit
                </span>
                <span className="text-gray-900 dark:text-white">
                  {formatMoney(totalCredit)}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-gray-500 dark:text-gray-400 text-[11px] font-medium">
                  Difference
                </span>
                <span
                  className={
                    difference === 0 && totalDebit > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : difference > 0
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-gray-500 dark:text-gray-400"
                  }
                >
                  {formatMoney(difference)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
        <div className="text-theme-xs font-medium w-full sm:w-auto">
          {!isBalanced ? (
            <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {difference > 0
                ? `Voucher cannot be created: Debits (${formatMoney(totalDebit)}) do not equal Credits (${formatMoney(totalCredit)}). Out of balance by ${formatMoney(difference)}.`
                : "Voucher cannot be created: Enter at least 2 balanced lines."}
            </span>
          ) : (
            <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Balanced voucher is ready to be recorded.
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!isBalanced || submitting}
            loading={submitting}
            title={
              !isBalanced
                ? `Voucher is out of balance by ${formatMoney(difference)}. Debits must equal Credits.`
                : "Create Journal Voucher"
            }
          >
            Create Journal Voucher
          </Button>
        </div>
      </div>
    </form>
  );
}

export function CreateJournalDialog({
  open,
  onClose,
  accounts,
  onSubmit,
}: CreateJournalDialogProps) {
  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create Journal Voucher"
      size="3xl"
    >
      <CreateJournalForm
        key={open ? "open" : "closed"}
        accounts={accounts}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </Dialog>
  );
}
