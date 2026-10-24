"use client";

import { useMemo, useState } from "react";
import type {
  FinancePaymentMade,
  UpdateFinancePaymentMadeInput,
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
import { useSuppliers } from "@/features/scm/suppliers/hooks";
import { useUpdatePaymentMade } from "../hooks";

export interface EditPaymentMadeDialogProps {
  open: boolean;
  onClose: () => void;
  payment: FinancePaymentMade | null;
  onSuccess?: (() => void) | undefined;
}

interface EditPaymentMadeFormProps {
  payment: FinancePaymentMade;
  onClose: () => void;
  onSuccess?: (() => void) | undefined;
}

function EditPaymentMadeForm({
  payment,
  onClose,
  onSuccess,
}: EditPaymentMadeFormProps) {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);

  const [paymentDate, setPaymentDate] = useState(
    payment.paymentDate ? payment.paymentDate.slice(0, 10) : today,
  );
  const [vendorName, setVendorName] = useState(payment.vendorName ?? "");
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | "">("");
  const [referenceNumber, setReferenceNumber] = useState(
    payment.referenceNumber ?? "",
  );
  const [billReference, setBillReference] = useState(
    payment.billReference ?? "",
  );
  const [notes, setNotes] = useState(payment.notes ?? "");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const suppliersQuery = useSuppliers({ limit: 100 });
  const suppliers = useMemo(
    () => suppliersQuery.data?.data ?? [],
    [suppliersQuery.data?.data],
  );

  const updateMutation = useUpdatePaymentMade();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setErrors({});

    const vName = vendorName.trim();
    if (!vName) {
      setErrors({ vendorName: "Vendor name is required" });
      return;
    }

    if (paymentDate > today) {
      setErrors({ paymentDate: "Payment date cannot be in the future" });
      return;
    }

    const payload: UpdateFinancePaymentMadeInput = {
      ...(paymentDate ? { paymentDate } : {}),
      vendorName: vName,
      ...(referenceNumber.trim()
        ? { referenceNumber: referenceNumber.trim() }
        : { referenceNumber: null }),
      ...(billReference.trim()
        ? { billReference: billReference.trim() }
        : { billReference: null }),
      ...(notes.trim() ? { notes: notes.trim() } : { notes: null }),
    };

    try {
      setSubmitting(true);
      await updateMutation.mutateAsync({
        id: payment.id,
        input: payload,
      });
      toast({
        title: `Draft payment ${payment.paymentNumber} updated successfully`,
        variant: "success",
      });
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Failed to update draft payment. Please verify details and try again.",
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
        <Alert variant="error" title="Could not update disbursement">
          {submitError}
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative focus-within:z-30">
        <FormField
          label="Vendor / Supplier"
          required
          error={errors.vendorName}
          hint="Select registered supplier or update vendor name"
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
                placeholder="Or enter vendor company name"
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
          hint="Date disbursed (cannot be in future)"
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
              placeholder="e.g. UTR12345 or CHQ-0012"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
            />
          )}
        </FormField>

        <FormField
          label="Primary Bill / PO Reference"
          hint="PO or vendor invoice voucher code"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              placeholder="e.g. PO-2026-0001 or BILL-0012"
              value={billReference}
              onChange={(e) => setBillReference(e.target.value)}
            />
          )}
        </FormField>
      </div>

      <FormField
        label="Disbursement Notes / Narration"
        hint="Narration printed on disbursement voucher"
      >
        {(fieldProps) => (
          <Textarea
            {...fieldProps}
            rows={3}
            placeholder="e.g. Revised invoice settlement terms..."
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

export function EditPaymentMadeDialog({
  open,
  onClose,
  payment,
  onSuccess,
}: EditPaymentMadeDialogProps) {
  if (!open || !payment) return null;

  // Enforce backend immutability rule: only DRAFT payments can be edited
  if (payment.status !== "DRAFT") {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title="Cannot Edit Payment Disbursement"
        size="md"
      >
        <div className="flex flex-col gap-4">
          <Alert variant="warning" title="Disbursement is Immutable">
            Only DRAFT payment disbursements can be edited. This payment is{" "}
            <strong>{payment.status}</strong> and cannot be modified directly.
            If changes are required, void the disbursement to create an audit
            reversal, then record a new payment.
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
          <span>Edit Draft Disbursement: {payment.paymentNumber}</span>
        </div>
      }
      size="2xl"
    >
      <EditPaymentMadeForm
        key={payment.id}
        payment={payment}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </Dialog>
  );
}
