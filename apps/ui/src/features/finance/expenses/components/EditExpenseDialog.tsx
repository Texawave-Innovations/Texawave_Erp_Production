"use client";

import { useMemo, useState } from "react";
import type {
  FinanceExpense,
  UpdateFinanceExpenseInput,
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
import {
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Pencil,
} from "lucide-react";
import { useAccounts } from "@/features/finance/coa/hooks";
import { useMasterListItems } from "@/features/finance-settings/hooks";
import { formatMoney } from "../../shared/format";
import { useActiveBankAccounts } from "../hooks";
import { updateExpenseSchema } from "../schema";

export interface EditExpenseDialogProps {
  expense: FinanceExpense | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (id: number, values: UpdateFinanceExpenseInput) => Promise<void>;
}

function EditExpenseForm({
  expense,
  onClose,
  onSubmit,
}: {
  expense: FinanceExpense;
  onClose: () => void;
  onSubmit: (id: number, values: UpdateFinanceExpenseInput) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);

  // Form State: Core
  const [expenseDate, setExpenseDate] = useState(
    expense.expenseDate.slice(0, 10),
  );
  const [expenseTypeId, setExpenseTypeId] = useState<number | "">(
    expense.expenseTypeId,
  );
  const [vendorName, setVendorName] = useState(expense.vendorName ?? "");
  const [amount, setAmount] = useState<number | "">(Number(expense.amount));
  const [paymentModeId, setPaymentModeId] = useState<number | "">(
    expense.paymentModeId ?? "",
  );
  const [bankAccountId, setBankAccountId] = useState<number | "">(
    expense.bankAccountId ?? "",
  );
  const [glAccountId, setGlAccountId] = useState<number | "">(
    expense.glAccountId ?? "",
  );
  const [notes, setNotes] = useState(expense.notes ?? "");
  const [receiptUrl, setReceiptUrl] = useState(expense.receiptUrl ?? "");

  // Optional GST State
  const initialHasGst = Boolean(
    (expense.taxAmount && Number(expense.taxAmount) > 0) ||
    expense.vendorGstin ||
    (expense.taxRate !== undefined &&
      expense.taxRate !== null &&
      Number(expense.taxRate) > 0) ||
    expense.vendorInvoiceNumber ||
    expense.hsnSacCode,
  );
  const [hasGstDetails, setHasGstDetails] = useState(initialHasGst);
  const [vendorGstin, setVendorGstin] = useState(expense.vendorGstin ?? "");
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState(
    expense.vendorInvoiceNumber ?? "",
  );
  const [vendorInvoiceDate, setVendorInvoiceDate] = useState(
    expense.vendorInvoiceDate ? expense.vendorInvoiceDate.slice(0, 10) : "",
  );
  const [hsnSacCode, setHsnSacCode] = useState(expense.hsnSacCode ?? "");
  const [taxRate, setTaxRate] = useState<number | "">(
    expense.taxRate !== undefined && expense.taxRate !== null
      ? Number(expense.taxRate)
      : 0,
  );
  const [taxAmount, setTaxAmount] = useState<number | "">(
    Number(expense.taxAmount || 0),
  );
  const [isItcEligible, setIsItcEligible] = useState(
    Boolean(expense.isItcEligible && Number(expense.taxAmount || 0) > 0),
  );
  const [ineligibilityReason, setIneligibilityReason] = useState(
    expense.ineligibilityReason ?? "",
  );
  const [gstJurisdiction, setGstJurisdiction] = useState<
    "INTRA_STATE" | "INTER_STATE" | ""
  >((expense.gstJurisdiction as "INTRA_STATE" | "INTER_STATE") ?? "");

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

  const numAmount = typeof amount === "number" ? amount : 0;
  const numTax =
    hasGstDetails && typeof taxAmount === "number" && taxAmount > 0
      ? taxAmount
      : 0;
  const netTotal = numAmount + numTax;

  const handleSubmit = async () => {
    setSubmitError(null);
    setErrors({});

    // Client-side guard: If user claims ITC, vendor GSTIN is required
    if (hasGstDetails && isItcEligible && numTax > 0 && !vendorGstin.trim()) {
      setErrors({
        vendorGstin:
          "A valid 15-character Vendor GSTIN is required to claim Input Tax Credit.",
      });
      return;
    }

    const rawInput = {
      expenseTypeId: expenseTypeId ? Number(expenseTypeId) : undefined,
      expenseDate,
      amount: numAmount,
      taxAmount: hasGstDetails ? numTax : 0,
      vendorName: vendorName.trim() || undefined,
      vendorGstin:
        hasGstDetails && vendorGstin.trim()
          ? vendorGstin.trim().toUpperCase()
          : undefined,
      vendorInvoiceNumber:
        hasGstDetails && vendorInvoiceNumber.trim()
          ? vendorInvoiceNumber.trim()
          : undefined,
      vendorInvoiceDate:
        hasGstDetails && vendorInvoiceDate ? vendorInvoiceDate : undefined,
      hsnSacCode:
        hasGstDetails && hsnSacCode.trim() ? hsnSacCode.trim() : undefined,
      taxRate:
        hasGstDetails && typeof taxRate === "number" ? taxRate : undefined,
      isItcEligible: hasGstDetails && numTax > 0 ? isItcEligible : false,
      ineligibilityReason:
        hasGstDetails && !isItcEligible && numTax > 0
          ? ineligibilityReason.trim() || undefined
          : undefined,
      gstJurisdiction:
        hasGstDetails && gstJurisdiction ? gstJurisdiction : undefined,
      paymentModeId: paymentModeId ? Number(paymentModeId) : undefined,
      bankAccountId: bankAccountId ? Number(bankAccountId) : undefined,
      glAccountId: glAccountId ? Number(glAccountId) : undefined,
      notes: notes.trim() || undefined,
      receiptUrl: receiptUrl.trim() || undefined,
    };

    const parsed = updateExpenseSchema.safeParse(rawInput);
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

    const payload: UpdateFinanceExpenseInput = {
      ...(parsed.data.expenseTypeId
        ? { expenseTypeId: parsed.data.expenseTypeId }
        : {}),
      ...(parsed.data.expenseDate
        ? { expenseDate: parsed.data.expenseDate }
        : {}),
      ...(parsed.data.amount !== undefined
        ? { amount: parsed.data.amount }
        : {}),
      taxAmount: parsed.data.taxAmount ?? 0,
      vendorName: parsed.data.vendorName ?? null,
      vendorGstin: parsed.data.vendorGstin ?? null,
      vendorInvoiceNumber: parsed.data.vendorInvoiceNumber ?? null,
      vendorInvoiceDate: parsed.data.vendorInvoiceDate ?? null,
      hsnSacCode: parsed.data.hsnSacCode ?? null,
      taxRate: parsed.data.taxRate ?? 0,
      isItcEligible: parsed.data.isItcEligible ?? false,
      ineligibilityReason: parsed.data.ineligibilityReason ?? null,
      gstJurisdiction: parsed.data.gstJurisdiction ?? null,
      paymentModeId: parsed.data.paymentModeId ?? null,
      bankAccountId: parsed.data.bankAccountId ?? null,
      glAccountId: parsed.data.glAccountId ?? null,
      notes: parsed.data.notes ?? null,
      receiptUrl: parsed.data.receiptUrl ?? null,
    };

    setSubmitting(true);
    try {
      await onSubmit(expense.id, payload);
      onClose();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to update expense",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 text-theme-sm relative focus-within:z-30">
      {submitError && (
        <Alert variant="error" title="Update Error">
          {submitError}
        </Alert>
      )}

      {/* Row 1: Category & Incurred Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="Expense Category"
          required
          error={errors.expenseTypeId}
          hint="Type of operating expense"
        >
          {() => (
            <Select
              value={expenseTypeId ? String(expenseTypeId) : ""}
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
          hint="Expense head in Chart of Accounts"
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

      {/* Row 3: Expense Amount & Disbursement */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField
          label="Expense Amount (₹)"
          required
          error={errors.amount}
          hint={
            hasGstDetails
              ? "Base amount before tax"
              : "Total expense amount paid or incurred"
          }
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              placeholder="0.00"
              onChange={(e) => {
                const val = e.target.value === "" ? "" : Number(e.target.value);
                setAmount(val);
                if (
                  hasGstDetails &&
                  typeof val === "number" &&
                  typeof taxRate === "number" &&
                  taxRate > 0
                ) {
                  setTaxAmount(Number(((val * taxRate) / 100).toFixed(2)));
                }
              }}
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

      {/* Net Total Summary (Shown when tax applies) */}
      {hasGstDetails && numTax > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-blue-50/70 p-3 border border-blue-100/70 dark:bg-blue-950/20 dark:border-blue-900/30">
          <div className="flex items-center gap-4 text-theme-xs text-blue-900 dark:text-sky-300">
            <span>
              Subtotal: <strong>{formatMoney(numAmount)}</strong>
            </span>
            <span>
              Tax / GST: <strong>{formatMoney(numTax)}</strong>
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-theme-xs font-semibold text-blue-900 dark:text-sky-300">
              Total Disbursement:
            </span>
            <span className="text-theme-base font-bold text-blue-700 dark:text-sky-400">
              {formatMoney(netTotal)}
            </span>
          </div>
        </div>
      )}

      {/* Optional GST & Tax Invoice Collapsible Section */}
      <div className="rounded-xl border border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/30 transition-all">
        <div className="flex items-center justify-between p-3.5">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="edit-toggle-gst"
              checked={hasGstDetails}
              onChange={(e) => {
                const checked = e.target.checked;
                setHasGstDetails(checked);
                if (!checked) {
                  setTaxAmount(0);
                  setTaxRate(0);
                  setIsItcEligible(false);
                  setVendorGstin("");
                  setVendorInvoiceNumber("");
                  setVendorInvoiceDate("");
                  setHsnSacCode("");
                }
              }}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <div>
              <label
                htmlFor="edit-toggle-gst"
                className="text-theme-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer flex items-center gap-1.5"
              >
                <FileText className="h-4 w-4 text-gray-500" />
                Include GST & Tax Invoice Details
              </label>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                Optional vendor GSTIN, tax breakdown, and recoverable Input Tax
                Credit (ITC)
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const next = !hasGstDetails;
              setHasGstDetails(next);
              if (!next) {
                setTaxAmount(0);
                setTaxRate(0);
                setIsItcEligible(false);
              }
            }}
            className="text-blue-600 dark:text-sky-400 flex items-center gap-1 text-theme-xs"
          >
            {hasGstDetails ? (
              <>
                Hide Details <ChevronDown className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Add Tax Details <ChevronRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>

        {hasGstDetails && (
          <div className="p-4 pt-3 border-t border-gray-200/80 dark:border-gray-800 space-y-3 relative focus-within:z-30">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField
                label="Vendor GSTIN"
                error={errors.vendorGstin}
                hint="15-character GSTIN (Required for ITC)"
              >
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    value={vendorGstin}
                    maxLength={15}
                    placeholder="e.g. 33AAMCT4293K1ZU"
                    onChange={(e) =>
                      setVendorGstin(e.target.value.toUpperCase())
                    }
                  />
                )}
              </FormField>

              <FormField
                label="Vendor Invoice No."
                error={errors.vendorInvoiceNumber}
                hint="Tax invoice reference"
              >
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    value={vendorInvoiceNumber}
                    placeholder="e.g. INV-2026-9081"
                    onChange={(e) => setVendorInvoiceNumber(e.target.value)}
                  />
                )}
              </FormField>

              <FormField
                label="Vendor Invoice Date"
                error={errors.vendorInvoiceDate}
                hint="Date on bill"
              >
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    type="date"
                    value={vendorInvoiceDate}
                    max={today}
                    onChange={(e) => setVendorInvoiceDate(e.target.value)}
                  />
                )}
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <FormField
                label="GST Rate (%)"
                error={errors.taxRate}
                hint="Standard rates"
              >
                {() => (
                  <Select
                    value={taxRate !== "" ? String(taxRate) : "0"}
                    onChange={(e) => {
                      const rate = Number(e.target.value);
                      setTaxRate(rate);
                      if (typeof amount === "number") {
                        setTaxAmount(
                          Number(((amount * rate) / 100).toFixed(2)),
                        );
                      }
                    }}
                  >
                    <option value="0">0% (Nil / Exempt)</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </Select>
                )}
              </FormField>

              <FormField
                label="Tax Amount (₹)"
                error={errors.taxAmount}
                hint="GST amount"
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

              <FormField
                label="HSN / SAC Code"
                error={errors.hsnSacCode}
                hint="Classification code"
              >
                {(fieldProps) => (
                  <Input
                    {...fieldProps}
                    value={hsnSacCode}
                    placeholder="e.g. 998311"
                    onChange={(e) => setHsnSacCode(e.target.value)}
                  />
                )}
              </FormField>

              <FormField
                label="Tax Jurisdiction"
                error={errors.gstJurisdiction}
                hint="Default auto-detects"
              >
                {() => (
                  <Select
                    value={gstJurisdiction}
                    onChange={(e) =>
                      setGstJurisdiction(
                        e.target.value as "INTRA_STATE" | "INTER_STATE" | "",
                      )
                    }
                  >
                    <option value="">Auto (Compare States)</option>
                    <option value="INTRA_STATE">Intra-State (CGST+SGST)</option>
                    <option value="INTER_STATE">Inter-State (IGST)</option>
                  </Select>
                )}
              </FormField>
            </div>

            {/* ITC Recovery Checkbox */}
            <div className="pt-2 border-t border-gray-200/80 dark:border-gray-800 space-y-2">
              <div className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="edit-itc-claim-checkbox"
                  checked={isItcEligible}
                  onChange={(e) => setIsItcEligible(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <div className="flex flex-col">
                  <label
                    htmlFor="edit-itc-claim-checkbox"
                    className="text-theme-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer"
                  >
                    Claim Input Tax Credit (ITC) for this expense
                  </label>
                  <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                    Only check if you possess a valid vendor tax invoice and
                    credit is not blocked under Section 17(5). If unchecked, tax
                    is absorbed directly into the expense cost.
                  </span>
                </div>
              </div>

              {!isItcEligible &&
                typeof taxAmount === "number" &&
                taxAmount > 0 && (
                  <div className="pl-6 pt-1">
                    <FormField
                      label="Section 17(5) Ineligibility Reason (Optional)"
                      error={errors.ineligibilityReason}
                      hint="Optional compliance note"
                    >
                      {() => (
                        <Select
                          value={ineligibilityReason}
                          onChange={(e) =>
                            setIneligibilityReason(e.target.value)
                          }
                        >
                          <option value="">
                            Standard Expense (Tax Absorbed)
                          </option>
                          <option value="Food, beverages, outdoor catering (Sec 17(5)(b))">
                            Food & beverages / catering (Sec 17(5)(b))
                          </option>
                          <option value="Travel benefits extended to employees (Sec 17(5)(b)(iii))">
                            Travel benefits to employees (Sec 17(5)(b)(iii))
                          </option>
                          <option value="Motor vehicles and conveyances (Sec 17(5)(a))">
                            Motor vehicles and conveyances (Sec 17(5)(a))
                          </option>
                          <option value="Personal consumption (Sec 17(5)(g))">
                            Personal consumption (Sec 17(5)(g))
                          </option>
                          <option value="Other ineligible / blocked credit under Section 17(5)">
                            Other Section 17(5) blocked credit
                          </option>
                        </Select>
                      )}
                    </FormField>
                  </div>
                )}
            </div>
          </div>
        )}
      </div>

      {/* Row 4: Receipt Document URL & Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="Receipt / Bill Document URL"
          error={errors.receiptUrl}
          hint="Link to scanned receipt or invoice"
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
          hint="Purpose or details of the expense"
        >
          {() => (
            <Textarea
              value={notes}
              rows={1}
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
          variant="primary"
          onClick={() => void handleSubmit()}
          disabled={submitting}
        >
          <Check className="h-4 w-4 mr-1.5" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}

export function EditExpenseDialog({
  expense,
  open,
  onClose,
  onSubmit,
}: EditExpenseDialogProps) {
  if (!open || !expense) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/50">
            <Pencil className="h-5 w-5" />
          </div>
          <div>
            <span className="text-theme-lg font-bold text-gray-900 dark:text-white">
              Edit Operating Expense
            </span>
            <p className="text-theme-xs font-normal text-gray-500 dark:text-gray-400">
              Update details for {expense.expenseNumber}
            </p>
          </div>
        </div>
      }
      size="2xl"
    >
      <EditExpenseForm
        expense={expense}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </Dialog>
  );
}
