"use client";

import { useState } from "react";
import type { FinancePaymentReceived } from "@texawave-erp/api-types";
import { Button, Dialog, Input, useToast } from "@texawave-erp/ui-kit";
import { Ban, Check, ExternalLink, Plus, Printer, Trash2 } from "lucide-react";
import Link from "next/link";
import { formatDate, formatDateTime, formatMoney } from "../../shared/format";
import { useAddPaymentAllocation, useRemovePaymentAllocation } from "../hooks";
import { printPaymentReceipt } from "../print/printPaymentReceipt";
import { PaymentReceivedStatusBadge } from "./PaymentReceivedStatusBadge";

export interface PaymentReceivedDetailDialogProps {
  open: boolean;
  onClose: () => void;
  payment: FinancePaymentReceived | null;
  canWrite: boolean;
  onConfirmClick?: (payment: FinancePaymentReceived) => void;
  onVoidClick?: (payment: FinancePaymentReceived) => void;
  onRefetch?: () => void;
}

export function PaymentReceivedDetailDialog({
  open,
  onClose,
  payment,
  canWrite,
  onConfirmClick,
  onVoidClick,
  onRefetch,
}: PaymentReceivedDetailDialogProps) {
  const { toast } = useToast();
  const [showAddAlloc, setShowAddAlloc] = useState(false);
  const [allocInvoiceRef, setAllocInvoiceRef] = useState("");
  const [allocAmount, setAllocAmount] = useState<number | "">("");
  const [allocNotes, setAllocNotes] = useState("");

  const addAllocationMutation = useAddPaymentAllocation();
  const removeAllocationMutation = useRemovePaymentAllocation();

  if (!open || !payment) return null;

  const totalAmount = Number(payment.amount || 0);
  const allocatedAmount = Number(payment.allocatedAmount || 0);
  const unallocatedAmount = Number(payment.unallocatedAmount || 0);
  const allocations = payment.allocations ?? [];

  const handleAddAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allocInvoiceRef.trim()) {
      toast({ title: "Please specify an invoice reference", variant: "error" });
      return;
    }
    const numAmount = Number(allocAmount);
    if (!numAmount || numAmount <= 0) {
      toast({
        title: "Allocation amount must be greater than zero",
        variant: "error",
      });
      return;
    }
    if (numAmount > unallocatedAmount) {
      toast({
        title: `Cannot allocate more than remaining unallocated balance (${formatMoney(unallocatedAmount)})`,
        variant: "error",
      });
      return;
    }

    try {
      await addAllocationMutation.mutateAsync({
        id: payment.id,
        input: {
          invoiceReference: allocInvoiceRef.trim(),
          allocatedAmount: numAmount,
          ...(allocNotes.trim() ? { notes: allocNotes.trim() } : {}),
        },
      });
      toast({
        title: "Invoice allocation recorded successfully",
        variant: "success",
      });
      setAllocInvoiceRef("");
      setAllocAmount("");
      setAllocNotes("");
      setShowAddAlloc(false);
      onRefetch?.();
    } catch (err: unknown) {
      toast({
        title:
          err instanceof Error ? err.message : "Failed to record allocation",
        variant: "error",
      });
    }
  };

  const handleRemoveAllocation = async (allocationId: number) => {
    try {
      await removeAllocationMutation.mutateAsync({
        id: payment.id,
        allocationId,
      });
      toast({
        title: "Allocation removed and balance restored",
        variant: "success",
      });
      onRefetch?.();
    } catch (err: unknown) {
      toast({
        title:
          err instanceof Error ? err.message : "Failed to remove allocation",
        variant: "error",
      });
    }
  };

  const handlePrint = () => {
    const success = printPaymentReceipt(payment);
    if (!success) {
      toast({
        title: "Pop-up blocked. Please allow pop-ups to print payment receipt.",
        variant: "error",
      });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <span>Receipt {payment.paymentNumber}</span>
          <PaymentReceivedStatusBadge status={payment.status} />
        </div>
      }
      size="3xl"
    >
      <div className="flex flex-col gap-5">
        {/* Header Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 text-theme-xs">
          <div className="flex flex-col gap-0.5">
            <span className="text-gray-500 dark:text-gray-400">
              Total Received
            </span>
            <span className="font-bold text-theme-sm text-emerald-600 dark:text-emerald-400">
              {formatMoney(totalAmount)}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-gray-500 dark:text-gray-400">
              Total Allocated
            </span>
            <span className="font-semibold text-theme-sm text-gray-900 dark:text-white">
              {formatMoney(allocatedAmount)}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-gray-500 dark:text-gray-400">
              Unallocated / Advance
            </span>
            <span className="font-semibold text-theme-sm text-blue-600 dark:text-blue-400">
              {formatMoney(unallocatedAmount)}
            </span>
          </div>

          <div className="flex flex-col gap-0.5">
            <span className="text-gray-500 dark:text-gray-400">
              Payment Date
            </span>
            <span className="font-semibold text-theme-sm text-gray-900 dark:text-white">
              {formatDate(payment.paymentDate)}
            </span>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-theme-xs">
          <div className="flex flex-col gap-2 p-3.5 rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900">
            <span className="font-bold uppercase tracking-wider text-gray-400">
              Customer Information
            </span>
            <div className="flex flex-col">
              <span className="text-theme-sm font-semibold text-gray-900 dark:text-white">
                {payment.customerName}
              </span>
              {payment.customer?.name &&
                payment.customer.name !== payment.customerName && (
                  <span className="text-gray-500 dark:text-gray-400">
                    CRM Account: {payment.customer.name}
                  </span>
                )}
              {payment.invoiceReference && (
                <span className="mt-1 text-blue-600 dark:text-sky-400">
                  Primary Invoice: <strong>{payment.invoiceReference}</strong>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 p-3.5 rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900">
            <span className="font-bold uppercase tracking-wider text-gray-400">
              Banking & Transaction
            </span>
            <div className="flex flex-col gap-1 text-gray-700 dark:text-gray-300">
              <div>
                <span className="text-gray-400">Mode: </span>
                <span className="font-semibold">
                  {payment.paymentMode?.value ?? "—"}
                </span>
              </div>
              {payment.referenceNumber && (
                <div>
                  <span className="text-gray-400">UTR / Ref: </span>
                  <span className="font-semibold">
                    {payment.referenceNumber}
                  </span>
                </div>
              )}
              {payment.bankAccount && (
                <div>
                  <span className="text-gray-400">Bank Account: </span>
                  <span className="font-semibold">
                    {payment.bankAccount.bankName} (
                    {payment.bankAccount.accountName})
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Linked GL Journal Entry banner */}
        {payment.journalEntry && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-900/60 text-theme-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-blue-900 dark:text-blue-200">
                General Ledger Posting:
              </span>
              <span className="font-bold text-blue-700 dark:text-blue-300">
                {payment.journalEntry.entryNumber}
              </span>
              <span className="text-blue-500 dark:text-blue-400">
                ({payment.journalEntry.status})
              </span>
            </div>
            <Link
              href="/finance/journal-entries"
              className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800 dark:text-sky-400 hover:underline"
            >
              <span>View in GL</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        )}

        {/* Notes */}
        {payment.notes && (
          <div className="flex flex-col gap-1 p-3.5 rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900">
            <span className="text-theme-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Notes / Remittance Narration
            </span>
            <p className="text-theme-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
              {payment.notes}
            </p>
          </div>
        )}

        {/* Allocations Table */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-theme-sm text-gray-900 dark:text-white">
              Invoice Allocations ({allocations.length})
            </h3>
            {canWrite && unallocatedAmount > 0 && !showAddAlloc && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddAlloc(true)}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Allocate To Invoice</span>
              </Button>
            )}
          </div>

          {/* Inline Add Allocation Form */}
          {showAddAlloc && (
            <form
              onSubmit={handleAddAllocation}
              className="flex flex-col gap-3 p-4 rounded-xl border border-blue-200/80 bg-blue-50/40 dark:border-blue-900/60 dark:bg-blue-950/20"
            >
              <span className="text-theme-xs font-bold text-blue-900 dark:text-blue-200">
                Allocate Portion of Available Balance (
                {formatMoney(unallocatedAmount)})
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex flex-col gap-1 text-theme-xs font-semibold text-gray-700 dark:text-gray-300">
                  <span>Invoice Reference *</span>
                  <Input
                    placeholder="e.g. INV-2026-0045"
                    value={allocInvoiceRef}
                    onChange={(e) => setAllocInvoiceRef(e.target.value)}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-theme-xs font-semibold text-gray-700 dark:text-gray-300">
                  <span>Allocated Amount (₹) *</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={unallocatedAmount}
                    placeholder={`Max ${unallocatedAmount}`}
                    value={allocAmount}
                    onChange={(e) =>
                      setAllocAmount(
                        e.target.value ? Number(e.target.value) : "",
                      )
                    }
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-theme-xs font-semibold text-gray-700 dark:text-gray-300">
                  <span>Allocation Notes (Optional)</span>
                  <Input
                    placeholder="e.g. Settlement of Q3 AMC"
                    value={allocNotes}
                    onChange={(e) => setAllocNotes(e.target.value)}
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2 mt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddAlloc(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={addAllocationMutation.isPending}
                >
                  Save Allocation
                </Button>
              </div>
            </form>
          )}

          {/* Table */}
          <div className="rounded-xl border border-gray-200/80 dark:border-gray-800 overflow-x-auto">
            <table className="w-full text-left text-theme-xs">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 font-semibold border-b border-gray-200/80 dark:border-gray-800">
                <tr>
                  <th className="py-2.5 px-3">Invoice Ref</th>
                  <th className="py-2.5 px-3">Allocation Date</th>
                  <th className="py-2.5 px-3">Notes</th>
                  <th className="py-2.5 px-3 text-right">Allocated Amount</th>
                  {canWrite && (
                    <th className="py-2.5 px-3 text-right">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {allocations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canWrite ? 5 : 4}
                      className="py-6 text-center text-gray-500 dark:text-gray-400 italic"
                    >
                      No individual invoice allocations yet. The full amount is
                      credited as customer unallocated balance.
                    </td>
                  </tr>
                ) : (
                  allocations.map((alloc) => (
                    <tr
                      key={alloc.id}
                      className="hover:bg-gray-50/50 dark:hover:bg-gray-900/40"
                    >
                      <td className="py-2 px-3 font-semibold text-gray-900 dark:text-white">
                        {alloc.invoiceReference}
                      </td>
                      <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                        {formatDate(alloc.allocationDate)}
                      </td>
                      <td className="py-2 px-3 text-gray-500 dark:text-gray-400 truncate max-w-xs">
                        {alloc.notes || "—"}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-white">
                        {formatMoney(alloc.allocatedAmount)}
                      </td>
                      {canWrite && (
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveAllocation(alloc.id)}
                            disabled={removeAllocationMutation.isPending}
                            className="text-rose-600 hover:text-rose-800 dark:text-rose-400 p-1 hover:bg-rose-50 rounded"
                            title="Remove allocation"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Audit & Action Footer */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-theme-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-4">
            <span>Created: {formatDateTime(payment.createdAt)}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Receipt</span>
            </Button>

            {payment.status === "DRAFT" && canWrite && onConfirmClick && (
              <Button
                size="sm"
                onClick={() => onConfirmClick(payment)}
                className="gap-1.5"
              >
                <Check className="h-4 w-4" />
                <span>Confirm & Post GL</span>
              </Button>
            )}

            {payment.status === "CONFIRMED" && canWrite && onVoidClick && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onVoidClick(payment)}
                className="gap-1.5 text-rose-700 border-rose-300 hover:bg-rose-50 dark:text-rose-300 dark:border-rose-800 dark:hover:bg-rose-950/40"
              >
                <Ban className="h-3.5 w-3.5" />
                <span>Void Receipt</span>
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
