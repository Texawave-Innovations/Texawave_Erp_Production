"use client";

import { useMemo, useState } from "react";
import type {
  FinancePaymentReceived,
  UpdateFinancePaymentReceivedInput,
} from "@texawave-erp/api-types";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
  Select,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { Pencil } from "lucide-react";
import { useAccounts } from "@/features/crm/accounts/hooks";
import { useUpdatePaymentReceived } from "../hooks";

export interface EditPaymentReceivedDialogProps {
  open: boolean;
  onClose: () => void;
  payment: FinancePaymentReceived | null;
  onSuccess?: (() => void) | undefined;
}

interface EditPaymentReceivedFormProps {
  payment: FinancePaymentReceived;
  onClose: () => void;
  onSuccess?: (() => void) | undefined;
}

function EditPaymentReceivedForm({
  payment,
  onClose,
  onSuccess,
}: EditPaymentReceivedFormProps) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const [paymentDate, setPaymentDate] = useState(
    payment.paymentDate ? payment.paymentDate.slice(0, 10) : today,
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | "">(
    payment.customerId ?? "",
  );
  const [customCustomerName, setCustomCustomerName] = useState(
    payment.customerName ?? "",
  );
  const [referenceNumber, setReferenceNumber] = useState(
    payment.referenceNumber ?? "",
  );
  const [invoiceReference, setInvoiceReference] = useState(
    payment.invoiceReference ?? "",
  );
  const [notes, setNotes] = useState(payment.notes ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const crmAccountsQuery = useAccounts({ limit: 100 });
  const crmAccounts = useMemo(
    () => crmAccountsQuery.data?.data ?? [],
    [crmAccountsQuery.data?.data],
  );

  const updateMutation = useUpdatePaymentReceived();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setErrors({});

    const custName = customCustomerName.trim();
    if (!custName) {
      setErrors({ customerName: "Customer name is required" });
      return;
    }

    if (paymentDate > today) {
      setErrors({ paymentDate: "Payment date cannot be in the future" });
      return;
    }

    const payload: UpdateFinancePaymentReceivedInput = {
      ...(paymentDate ? { paymentDate } : {}),
      customerName: custName,
      ...(selectedCustomerId ? { customerId: Number(selectedCustomerId) } : {}),
      ...(referenceNumber.trim()
        ? { referenceNumber: referenceNumber.trim() }
        : { referenceNumber: null }),
      ...(invoiceReference.trim()
        ? { invoiceReference: invoiceReference.trim() }
        : { invoiceReference: null }),
      ...(notes.trim() ? { notes: notes.trim() } : { notes: null }),
    };

    try {
      setSubmitting(true);
      await updateMutation.mutateAsync({
        id: payment.id,
        input: payload,
      });
      toast({
        title: `Draft receipt ${payment.paymentNumber} updated successfully`,
        variant: "success",
      });
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Failed to update payment receipt. Please verify details and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 relative focus-within:z-30"
    >
      {submitError && (
        <Alert variant="error" title="Could not update receipt">
          {submitError}
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative focus-within:z-30">
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
          hint="Date received (cannot be in future)"
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative focus-within:z-30">
        <FormField
          label="Reference / UTR #"
          hint="Bank UTR, Cheque #, or UPI Reference"
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
          label="Primary Invoice Reference"
          hint="Voucher code being settled"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              placeholder="e.g. TW/IN/26-27/8071"
              value={invoiceReference}
              onChange={(e) => setInvoiceReference(e.target.value)}
            />
          )}
        </FormField>
      </div>

      <FormField
        label="Remittance Notes"
        hint="Audit remarks or client remittance narration"
      >
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            rows={3}
            placeholder="e.g. Client advance settlement against milestone 2..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        )}
      </FormField>

      <div className="flex items-center justify-between pt-4 border-t border-gray-200/80 dark:border-gray-800">
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
          disabled={submitting}
          className="gap-2 bg-linear-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white"
        >
          <Pencil className="h-4 w-4" />
          <span>Save Changes</span>
        </Button>
      </div>
    </form>
  );
}

export function EditPaymentReceivedDialog({
  open,
  onClose,
  payment,
  onSuccess,
}: EditPaymentReceivedDialogProps) {
  if (!open || !payment) return null;

  // Only allow editing draft receipts
  if (payment.status !== "DRAFT") {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title="Cannot Edit Receipt"
        size="md"
      >
        <div className="flex flex-col gap-4">
          <Alert variant="warning" title="Receipt is Immutable">
            Only DRAFT payment receipts can be edited. This receipt is{" "}
            <strong>{payment.status}</strong> and cannot be modified directly.
          </Alert>
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Pencil className="h-5 w-5 text-blue-600 dark:text-sky-400" />
          <span>Edit Draft Receipt: {payment.paymentNumber}</span>
        </div>
      }
      size="2xl"
    >
      <EditPaymentReceivedForm
        key={payment.id}
        payment={payment}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </Dialog>
  );
}
