"use client";

import { useId, useMemo, useState } from "react";
import type {
  CreateFinancePaymentReceivedInput,
  CreatePaymentAllocationInput,
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
import { ArrowDownLeft, Plus, Trash2 } from "lucide-react";
import { useAccounts } from "@/features/crm/accounts/hooks";
import { useMasterListItems } from "@/features/finance-settings/hooks";
import { formatMoney } from "../../shared/format";
import { useActiveBankAccounts } from "../hooks";
import { createPaymentReceivedSchema } from "../schema";

export interface RecordPaymentReceivedDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CreateFinancePaymentReceivedInput) => Promise<void>;
}

interface EditableAllocation {
  tempId: string;
  invoiceReference: string;
  allocatedAmount: number;
  notes: string;
}

function RecordPaymentReceivedForm({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (values: CreateFinancePaymentReceivedInput) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const allocInitId = useId();

  // Form State
  const [paymentDate, setPaymentDate] = useState(today);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | "">("");
  const [customCustomerName, setCustomCustomerName] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [paymentModeId, setPaymentModeId] = useState<number | "">("");
  const [bankAccountId, setBankAccountId] = useState<number | "">("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [primaryInvoiceRef, setPrimaryInvoiceRef] = useState("");
  const [notes, setNotes] = useState("");

  const [allocations, setAllocations] = useState<EditableAllocation[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // External queries
  const crmAccountsQuery = useAccounts({ limit: 100 });
  const paymentModesQuery = useMasterListItems({
    category: "payment_mode",
    limit: 100,
  });
  const bankAccountsQuery = useActiveBankAccounts();

  const crmAccounts = useMemo(
    () => crmAccountsQuery.data?.data ?? [],
    [crmAccountsQuery.data?.data],
  );

  const paymentModes = useMemo(
    () => paymentModesQuery.data?.data ?? [],
    [paymentModesQuery.data?.data],
  );

  const bankAccounts = useMemo(
    () => bankAccountsQuery.data ?? [],
    [bankAccountsQuery.data],
  );

  // Derive default payment mode if not explicitly chosen
  const effectivePaymentModeId =
    paymentModeId || (paymentModes.length > 0 ? paymentModes[0]!.id : "");

  // Handle customer selection
  const handleCustomerChange = (val: string) => {
    if (!val) {
      setSelectedCustomerId("");
      setCustomCustomerName("");
      return;
    }
    const id = Number(val);
    setSelectedCustomerId(id);
    const found = crmAccounts.find((c) => c.id === id);
    if (found) {
      setCustomCustomerName(found.name);
    }
  };

  // Allocations calculations
  const totalReceived = Number(amount || 0);
  const totalAllocated = useMemo(() => {
    const sum = allocations.reduce(
      (acc, item) => acc + Number(item.allocatedAmount || 0),
      0,
    );
    return Math.round(sum * 100) / 100;
  }, [allocations]);

  const unallocatedAmount = useMemo(() => {
    const diff = Math.max(0, totalReceived - totalAllocated);
    return Math.round(diff * 100) / 100;
  }, [totalReceived, totalAllocated]);

  const addAllocationRow = () => {
    const newId = `alloc-${allocInitId}-${allocations.length + 1}-${Date.now()}`;
    const defaultInvoiceRef =
      primaryInvoiceRef && allocations.length === 0 ? primaryInvoiceRef : "";
    const defaultAmount = unallocatedAmount > 0 ? unallocatedAmount : 0;

    setAllocations([
      ...allocations,
      {
        tempId: newId,
        invoiceReference: defaultInvoiceRef,
        allocatedAmount: defaultAmount,
        notes: "",
      },
    ]);
  };

  const removeAllocationRow = (tempId: string) => {
    setAllocations(allocations.filter((a) => a.tempId !== tempId));
  };

  const updateAllocationRow = (
    tempId: string,
    field: keyof EditableAllocation,
    val: string | number,
  ) => {
    setAllocations(
      allocations.map((a) =>
        a.tempId === tempId ? { ...a, [field]: val } : a,
      ),
    );
  };

  const handleSubmit = async (targetStatus: "CONFIRMED" | "DRAFT") => {
    setSubmitError(null);
    setErrors({});

    const customerName = customCustomerName.trim();
    if (!customerName) {
      setErrors({ customerName: "Customer name is required" });
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setErrors({ amount: "Amount received must be greater than zero" });
      return;
    }

    const finalModeId = Number(effectivePaymentModeId);
    if (!finalModeId) {
      setErrors({ paymentModeId: "Please select a payment mode" });
      return;
    }

    const cleanedAllocations: CreatePaymentAllocationInput[] = allocations
      .filter((a) => a.invoiceReference.trim() && Number(a.allocatedAmount) > 0)
      .map((a) => {
        const item: CreatePaymentAllocationInput = {
          invoiceReference: a.invoiceReference.trim(),
          allocatedAmount: Number(a.allocatedAmount),
          ...(a.notes.trim() ? { notes: a.notes.trim() } : {}),
        };
        return item;
      });

    const payload: CreateFinancePaymentReceivedInput = {
      paymentDate,
      customerName,
      amount: Number(amount),
      paymentModeId: finalModeId,
      status: targetStatus,
      ...(selectedCustomerId ? { customerId: Number(selectedCustomerId) } : {}),
      ...(bankAccountId ? { bankAccountId: Number(bankAccountId) } : {}),
      ...(referenceNumber.trim()
        ? { referenceNumber: referenceNumber.trim() }
        : {}),
      ...(primaryInvoiceRef.trim()
        ? { invoiceReference: primaryInvoiceRef.trim() }
        : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(cleanedAllocations.length > 0
        ? { allocations: cleanedAllocations }
        : {}),
    };

    // Client-side Zod validation
    const parsed = createPaymentReceivedSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        fieldErrors[path] = issue.message;
      }
      setErrors(fieldErrors);
      setSubmitError(
        parsed.error.issues[0]?.message ?? "Please resolve validation errors",
      );
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit(payload);
      onClose();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Failed to record payment received. Please check balances and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 relative focus-within:z-30">
      {submitError && (
        <Alert variant="error" title="Could not record payment">
          {submitError}
        </Alert>
      )}

      {/* 1. Header Information Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 relative focus-within:z-30">
        <FormField
          label="Customer / Client"
          required
          error={errors.customerName}
          hint="Select existing CRM account or enter client name"
        >
          {() => (
            <div className="flex flex-col gap-1.5">
              <Select
                value={selectedCustomerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
              >
                <option value="">-- Choose Existing CRM Account --</option>
                {crmAccounts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <Input
                placeholder="Or enter client company name"
                value={customCustomerName}
                onChange={(e) => {
                  setCustomCustomerName(e.target.value);
                  if (selectedCustomerId) setSelectedCustomerId("");
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
          hint="Deposit date (cannot be future date)"
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

        <FormField
          label="Amount Received (₹)"
          required
          error={errors.amount}
          hint="Total funds received from client"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value ? Number(e.target.value) : "")
              }
              required
            />
          )}
        </FormField>
      </div>

      {/* 2. Payment Channel & References */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 relative focus-within:z-30">
        <FormField label="Payment Mode" required error={errors.paymentModeId}>
          {(fieldProps) => (
            <Select
              {...fieldProps}
              value={effectivePaymentModeId}
              onChange={(e) => setPaymentModeId(Number(e.target.value))}
            >
              <option value="">-- Select Mode --</option>
              {paymentModes.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.value}
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField
          label="Deposit Bank Account"
          hint="Optional GL cash/bank target"
        >
          {(fieldProps) => (
            <Select
              {...fieldProps}
              value={bankAccountId}
              onChange={(e) =>
                setBankAccountId(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">-- Select Bank Account --</option>
              {bankAccounts.map((ba) => (
                <option key={ba.id} value={ba.id}>
                  {ba.bankName} - {ba.accountName} ({ba.accountNumber})
                </option>
              ))}
            </Select>
          )}
        </FormField>

        <FormField
          label="Reference / UTR #"
          hint="Bank UTR, Cheque #, or UPI Ref"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              placeholder="e.g. sbi@78876543 or UTR12345"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
            />
          )}
        </FormField>

        <FormField
          label="Primary Invoice Ref"
          hint="Default invoice voucher code"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              placeholder="e.g. TW/IN/26-27/8071"
              value={primaryInvoiceRef}
              onChange={(e) => setPrimaryInvoiceRef(e.target.value)}
            />
          )}
        </FormField>
      </div>

      {/* 3. Notes & Remittance Narration */}
      <div className="relative focus-within:z-30">
        <FormField
          label="Remittance Notes"
          hint="Audit remarks or client remittance narration"
        >
          {(fieldProps) => (
            <Textarea
              {...fieldProps}
              rows={2}
              placeholder="e.g. Client advance settlement against project milestones..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          )}
        </FormField>
      </div>

      {/* 4. Multi-Invoice Allocations Table */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200/80 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/50 relative focus-within:z-30">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-theme-sm text-gray-900 dark:text-white">
              Invoice Allocation Breakdown (Optional)
            </h3>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              Apply this receipt across one or more customer invoices. Any
              unallocated amount remains as on-account advance credit.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addAllocationRow}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Invoice</span>
          </Button>
        </div>

        {allocations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-theme-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
            No individual invoice allocation rows added. The full amount (
            {formatMoney(totalReceived)}) will be recorded as unallocated
            customer credit.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {allocations.map((alloc, idx) => (
              <div
                key={alloc.tempId}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-200/80 dark:border-gray-800 shadow-2xs"
              >
                <div className="sm:col-span-4">
                  <Input
                    placeholder="Invoice Reference #"
                    value={alloc.invoiceReference}
                    onChange={(e) =>
                      updateAllocationRow(
                        alloc.tempId,
                        "invoiceReference",
                        e.target.value,
                      )
                    }
                    required
                  />
                </div>
                <div className="sm:col-span-3">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Allocated ₹"
                    value={alloc.allocatedAmount || ""}
                    onChange={(e) =>
                      updateAllocationRow(
                        alloc.tempId,
                        "allocatedAmount",
                        e.target.value ? Number(e.target.value) : 0,
                      )
                    }
                    required
                  />
                </div>
                <div className="sm:col-span-4">
                  <Input
                    placeholder="Notes (optional)"
                    value={alloc.notes}
                    onChange={(e) =>
                      updateAllocationRow(alloc.tempId, "notes", e.target.value)
                    }
                  />
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeAllocationRow(alloc.tempId)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg dark:hover:bg-rose-950/40"
                    title={`Remove invoice ${idx + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Live Allocation Summary Totals */}
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 text-theme-xs">
          <div className="flex flex-col">
            <span className="text-gray-500 dark:text-gray-400">
              Total Inflow Amount
            </span>
            <span className="font-bold text-theme-sm text-emerald-600 dark:text-emerald-400">
              {formatMoney(totalReceived)}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-gray-500 dark:text-gray-400">
              Allocated to Invoices
            </span>
            <span className="font-semibold text-theme-sm text-gray-900 dark:text-white">
              {formatMoney(totalAllocated)}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-gray-500 dark:text-gray-400">
              Unallocated Advance Credit
            </span>
            <span
              className={`font-bold text-theme-sm ${
                unallocatedAmount > 0
                  ? "text-blue-600 dark:text-sky-400"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              {formatMoney(unallocatedAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* 5. Action Buttons Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-200/80 dark:border-gray-800">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </Button>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSubmit("DRAFT")}
            disabled={submitting}
            className="flex-1 sm:flex-none"
          >
            Save as Draft
          </Button>

          <Button
            type="button"
            onClick={() => handleSubmit("CONFIRMED")}
            disabled={submitting}
            className="flex-1 sm:flex-none gap-2 bg-linear-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white"
          >
            <ArrowDownLeft className="h-4 w-4" />
            <span>Record & Post to GL</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function RecordPaymentReceivedDialog({
  open,
  onClose,
  onSubmit,
}: RecordPaymentReceivedDialogProps) {
  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <ArrowDownLeft className="h-5 w-5 text-emerald-600" />
          <span>Record Customer Payment Received</span>
        </div>
      }
      size="3xl"
    >
      <RecordPaymentReceivedForm onClose={onClose} onSubmit={onSubmit} />
    </Dialog>
  );
}
