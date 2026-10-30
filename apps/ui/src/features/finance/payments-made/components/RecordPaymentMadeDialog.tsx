"use client";

import { useMemo, useState } from "react";
import type { CreateFinancePaymentMadeInput } from "@texawave-erp/api-types";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
  Select,
  Textarea,
} from "@texawave-erp/ui-kit";
import { Check, Clock, Wallet } from "lucide-react";
import { useMasterListItems } from "@/features/finance-settings/hooks";
import { useSuppliers } from "@/features/scm/suppliers/hooks";
import { useActiveBankAccounts } from "../hooks";
import { createPaymentMadeSchema } from "../schema";

export interface RecordPaymentMadeDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CreateFinancePaymentMadeInput) => Promise<void>;
}

function RecordPaymentMadeForm({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (values: CreateFinancePaymentMadeInput) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);

  // Form State
  const [paymentDate, setPaymentDate] = useState(today);
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | "">("");
  const [vendorName, setVendorName] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [paymentModeId, setPaymentModeId] = useState<number | "">("");
  const [bankAccountId, setBankAccountId] = useState<number | "">("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [billReference, setBillReference] = useState("");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // External queries
  const suppliersQuery = useSuppliers({ limit: 100 });
  const paymentModesQuery = useMasterListItems({
    category: "payment_mode",
    limit: 100,
  });
  const bankAccountsQuery = useActiveBankAccounts();

  const suppliers = useMemo(
    () => suppliersQuery.data?.data ?? [],
    [suppliersQuery.data?.data],
  );

  const paymentModes = useMemo(
    () => paymentModesQuery.data?.data ?? [],
    [paymentModesQuery.data?.data],
  );

  const bankAccounts = useMemo(
    () => bankAccountsQuery.data ?? [],
    [bankAccountsQuery.data],
  );

  const effectivePaymentModeId =
    paymentModeId || (paymentModes.length > 0 ? paymentModes[0]!.id : "");

  const handleSupplierChange = (val: string) => {
    if (!val) {
      setSelectedSupplierId("");
      return;
    }
    const id = Number(val);
    setSelectedSupplierId(id);
    const found = suppliers.find((s) => s.id === id);
    if (found) {
      setVendorName(found.companyName);
    }
  };

  const selectedModeObj = paymentModes.find(
    (m) => m.id === Number(effectivePaymentModeId),
  );
  // Matches the backend's cash-vs-bank classification exactly
  // (isCashPaymentMode in apps/api/.../finance.constants.ts): every mode
  // other than cash settles through a real bank account.
  const isCashMode = Boolean(
    selectedModeObj?.value.toLowerCase().includes("cash"),
  );
  const isBankMode = !isCashMode;

  const handleSubmit = async (targetStatus: "CONFIRMED" | "DRAFT") => {
    setSubmitError(null);
    setErrors({});

    const rawValues = {
      paymentDate,
      vendorName: vendorName.trim(),
      amount: typeof amount === "number" ? amount : 0,
      paymentModeId: Number(effectivePaymentModeId),
      bankAccountId: bankAccountId ? Number(bankAccountId) : null,
      referenceNumber: referenceNumber.trim() ? referenceNumber.trim() : null,
      billReference: billReference.trim() ? billReference.trim() : null,
      notes: notes.trim() ? notes.trim() : null,
      status: targetStatus,
    };

    const parsed = createPaymentMadeSchema.safeParse(rawValues);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const fieldName = issue.path[0]?.toString() ?? "general";
        fieldErrors[fieldName] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    if (isBankMode && !parsed.data.bankAccountId) {
      setErrors({
        bankAccountId: `A disbursing bank account is required for "${selectedModeObj?.value ?? "this"}" payments so the bank balance and transaction ledger stay in sync.`,
      });
      return;
    }

    const payload: CreateFinancePaymentMadeInput = {
      paymentDate: parsed.data.paymentDate,
      vendorName: parsed.data.vendorName,
      amount: parsed.data.amount,
      paymentModeId: parsed.data.paymentModeId,
      ...(parsed.data.bankAccountId
        ? { bankAccountId: parsed.data.bankAccountId }
        : {}),
      ...(parsed.data.referenceNumber
        ? { referenceNumber: parsed.data.referenceNumber }
        : {}),
      ...(parsed.data.billReference
        ? { billReference: parsed.data.billReference }
        : {}),
      ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
      status: targetStatus,
    };

    try {
      setSubmitting(true);
      await onSubmit(payload);
      onClose();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Failed to record payment. Please check required fields and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit("CONFIRMED");
      }}
      className="flex flex-col gap-5 relative focus-within:z-30"
    >
      {submitError && (
        <Alert variant="error" title="Submission Error">
          {submitError}
        </Alert>
      )}

      {/* Row 1: Vendor Selection & Payment Date */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative focus-within:z-30">
        <FormField
          label="Vendor / Supplier"
          required
          error={errors.vendorName}
          hint="Select registered supplier or type vendor name"
        >
          {() => (
            <div className="flex flex-col gap-1.5">
              <Select
                value={selectedSupplierId}
                onChange={(e) => handleSupplierChange(e.target.value)}
              >
                <option value="">-- Choose SCM Supplier (Optional) --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.companyName}{" "}
                    {s.supplierCode ? `(${s.supplierCode})` : ""}
                  </option>
                ))}
              </Select>
              <Input
                placeholder="Or enter payee company name"
                value={vendorName}
                onChange={(e) => {
                  setVendorName(e.target.value);
                  if (selectedSupplierId) setSelectedSupplierId("");
                }}
                required
              />
            </div>
          )}
        </FormField>

        <FormField
          label="Payment Date"
          required
          error={errors.paymentDate}
          hint="Date cleared / disbursed (past or today)"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="date"
              max={today}
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          )}
        </FormField>
      </div>

      {/* Row 2: Amount & Payment Mode */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative focus-within:z-30">
        <FormField
          label="Disbursement Amount (₹)"
          required
          error={errors.amount}
          hint="Net payment disbursed in INR"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                const val = e.target.value;
                setAmount(val === "" ? "" : Number(val));
              }}
              required
            />
          )}
        </FormField>

        <FormField
          label="Payment Mode"
          required
          error={errors.paymentModeId}
          hint="Master list disbursement channel"
        >
          {() => (
            <Select
              value={effectivePaymentModeId}
              onChange={(e) => setPaymentModeId(Number(e.target.value))}
              required
            >
              {paymentModes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.value}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      </div>

      {/* Row 3: Source Bank Account & Reference */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative focus-within:z-30">
        <FormField
          label="Disbursing Bank Account"
          required={isBankMode}
          error={errors.bankAccountId}
          hint={
            isBankMode
              ? "Required for bank transactions and GL balance deduction"
              : "Optional for cash payments"
          }
        >
          {() => (
            <Select
              value={bankAccountId}
              onChange={(e) => {
                setBankAccountId(e.target.value ? Number(e.target.value) : "");
                if (errors.bankAccountId) {
                  setErrors((prev) => {
                    const { bankAccountId: _discard, ...rest } = prev;
                    return rest;
                  });
                }
              }}
              required={isBankMode}
            >
              <option value="">
                {isBankMode
                  ? "-- Select Disbursing Bank Account --"
                  : "-- Cash on Hand (Default) --"}
              </option>
              {bankAccounts.map((ba) => (
                <option key={ba.id} value={ba.id}>
                  {ba.accountName} ({ba.accountNumber.slice(-4)})
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField
          label="Reference / UTR #"
          hint="Bank UTR, Cheque #, or UPI Reference"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              placeholder="e.g. UTR12345678 or CHQ-0045"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
            />
          )}
        </FormField>
      </div>

      {/* Row 4: Bill / PO Reference */}
      <div className="relative focus-within:z-30">
        <FormField
          label="Purchase Order or Bill Reference"
          hint="Optional PO number or vendor invoice reference being liquidated"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              placeholder="e.g. PO-2026-0001 or BILL-202610-0012"
              value={billReference}
              onChange={(e) => setBillReference(e.target.value)}
            />
          )}
        </FormField>
      </div>

      {/* Row 5: Remittance Notes */}
      <FormField
        label="Disbursement Notes / Narration"
        hint="Narration printed on disbursement voucher and posted to GL journal"
      >
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            rows={2}
            placeholder="e.g. Settlement of vendor bill against milestone 1 delivery..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        )}
      </FormField>

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-200/80 dark:border-gray-800">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </Button>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => handleSubmit("DRAFT")}
            className="gap-1.5 text-gray-700 dark:text-gray-200"
          >
            <Clock className="h-4 w-4" />
            <span>Save as Draft</span>
          </Button>

          <Button
            type="submit"
            disabled={submitting}
            className="gap-2 bg-linear-to-r from-blue-600 via-sky-600 to-cyan-600 hover:from-blue-700 hover:to-sky-700 text-white font-semibold shadow-xs"
          >
            <Check className="h-4 w-4" />
            <span>Record & Post to GL</span>
          </Button>
        </div>
      </div>
    </form>
  );
}

export function RecordPaymentMadeDialog({
  open,
  onClose,
  onSubmit,
}: RecordPaymentMadeDialogProps) {
  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/50">
            <Wallet className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <span className="text-theme-lg font-bold text-gray-900 dark:text-white">
              Record Supplier Disbursement
            </span>
            <p className="text-theme-xs font-normal text-gray-500 dark:text-gray-400">
              Disburse outgoing funds against vendor liabilities with automated
              GL posting
            </p>
          </div>
        </div>
      }
      size="2xl"
    >
      <RecordPaymentMadeForm onClose={onClose} onSubmit={onSubmit} />
    </Dialog>
  );
}
