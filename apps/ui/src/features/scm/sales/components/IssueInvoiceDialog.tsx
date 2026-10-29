"use client";

import type { SalesOrder } from "@texawave-erp/api-types";
import {
  Button,
  Dialog,
  FormField,
  Input,
  Select,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, FileCheck, Receipt, AlertCircle } from "lucide-react";
import { useState } from "react";
import { formatMoney, formatQty } from "../../shared/format";
import { errorText } from "../../shared/use-list-controls";
import { useIssueSalesInvoice, type IssueSalesInvoiceResult } from "../hooks";

export interface IssueInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  order: SalesOrder;
  onSuccess?: (result: IssueSalesInvoiceResult) => void;
}

function round2(val: number): number {
  return Number(Number(val).toFixed(2));
}

export function IssueInvoiceDialog({
  open,
  onClose,
  order,
  onSuccess,
}: IssueInvoiceDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const issueMutation = useIssueSalesInvoice();

  const todayStr = new Date().toISOString().slice(0, 10);
  const customerGstin =
    (order.customer as { gstin?: string } | undefined)?.gstin?.trim() || null;
  const upperGstin = customerGstin?.toUpperCase();
  const defaultJurisdiction =
    upperGstin && upperGstin.length >= 2 && !upperGstin.startsWith("29")
      ? "INTER_STATE"
      : "INTRA_STATE";

  const [invoiceDate, setInvoiceDate] = useState(todayStr);
  const [customInvoiceNumber, setCustomInvoiceNumber] = useState("");
  const [jurisdiction, setJurisdiction] = useState<
    "INTRA_STATE" | "INTER_STATE"
  >(defaultJurisdiction);
  const [notes, setNotes] = useState(order.notes ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  const subtotal = Number(order.subtotal);
  const taxAmount = Number(order.taxAmount);
  const total = Number(order.total);

  // Compute preview tax breakdown
  const isInter = jurisdiction === "INTER_STATE";
  const cgstAmount = isInter ? 0 : round2(taxAmount / 2);
  const sgstAmount = isInter ? 0 : round2(taxAmount - cgstAmount);
  const igstAmount = isInter ? taxAmount : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (invoiceDate > todayStr) {
      setFormError("Invoice date cannot be in the future.");
      return;
    }

    try {
      const result = await issueMutation.mutateAsync({
        id: order.id,
        payload: {
          invoiceDate,
          ...(customInvoiceNumber.trim()
            ? { customInvoiceNumber: customInvoiceNumber.trim() }
            : {}),
          jurisdiction,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        },
      });

      toast({
        title: "Tax Invoice Issued",
        description: `Invoice ${result.invoiceNumber} posted to General Ledger and GST Return ledger.`,
        variant: "success",
      });

      // Invalidate all affected queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sales-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["gst"] }),
        queryClient.invalidateQueries({ queryKey: ["gst-entries"] }),
        queryClient.invalidateQueries({ queryKey: ["gstr1"] }),
        queryClient.invalidateQueries({ queryKey: ["gstr3b"] }),
        queryClient.invalidateQueries({ queryKey: ["hsn-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["journal-entries"] }),
        queryClient.invalidateQueries({ queryKey: ["finance"] }),
      ]);

      if (onSuccess) {
        onSuccess(result);
      }
      onClose();
    } catch (err) {
      const msg = errorText(err, "Failed to issue tax invoice");
      setFormError(msg);
      toast({
        title: "Invoice Issuance Failed",
        description: msg,
        variant: "error",
      });
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Issue Tax Invoice"
      size="2xl"
      className="sm:max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header Alert / Info */}
        <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4 dark:border-sky-950 dark:bg-sky-950/30">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1769F5]/10 text-[#1769F5]">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-theme-sm font-semibold text-gray-900 dark:text-white">
                Finalizing Sales Order {order.soNumber}
              </h4>
              <p className="mt-0.5 text-theme-xs text-gray-600 dark:text-gray-400">
                Issuing this invoice will post a balanced double-entry voucher
                to the General Ledger and record statutory tax liabilities in
                the GSTR-1 and GSTR-3B return ledgers.
              </p>
            </div>
          </div>
        </div>

        {formError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-theme-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        ) : null}

        {/* Customer & Order Metadata */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-xl border border-gray-200 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-900/40">
          <div>
            <span className="text-theme-xs font-medium uppercase tracking-wide text-gray-500">
              Customer
            </span>
            <div className="mt-1 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-400" />
              <span className="text-theme-sm font-semibold text-gray-900 dark:text-white">
                {order.customerName}
              </span>
            </div>
          </div>

          <div>
            <span className="text-theme-xs font-medium uppercase tracking-wide text-gray-500">
              Customer GSTIN
            </span>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-theme-sm font-medium text-gray-900 dark:text-white">
                {customerGstin || "Unregistered Person (URP / B2C)"}
              </span>
            </div>
          </div>
        </div>

        {/* Invoicing Controls */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="Invoice Date" required>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="date"
                value={invoiceDate}
                max={todayStr}
                onChange={(e) => setInvoiceDate(e.target.value)}
                required
              />
            )}
          </FormField>

          <FormField label="Tax Jurisdiction" required>
            {(fieldProps) => (
              <Select
                {...fieldProps}
                value={jurisdiction}
                onChange={(e) =>
                  setJurisdiction(
                    e.target.value as "INTRA_STATE" | "INTER_STATE",
                  )
                }
              >
                <option value="INTRA_STATE">Intra-State (CGST + SGST)</option>
                <option value="INTER_STATE">Inter-State (IGST)</option>
              </Select>
            )}
          </FormField>

          <FormField label="Invoice Number" hint="Leave blank to auto-generate">
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="text"
                placeholder="TW/INV/26-27/..."
                value={customInvoiceNumber}
                onChange={(e) => setCustomInvoiceNumber(e.target.value)}
              />
            )}
          </FormField>
        </div>

        {/* Line Items Summary */}
        <div>
          <h5 className="text-theme-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
            Invoice Items ({order.items?.length ?? 0})
          </h5>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-x-auto">
            <table className="w-full text-left text-theme-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-gray-500">
                <tr>
                  <th className="py-2 px-3 font-semibold">Item</th>
                  <th className="py-2 px-3 font-semibold text-right">Qty</th>
                  <th className="py-2 px-3 font-semibold text-right">
                    Unit Price
                  </th>
                  <th className="py-2 px-3 font-semibold text-right">
                    Tax Rate
                  </th>
                  <th className="py-2 px-3 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {order.items?.map((it) => (
                  <tr key={it.id}>
                    <td className="py-2 px-3 text-gray-900 dark:text-white font-medium">
                      {it.itemDescription || it.itemCode}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">
                      {formatQty(it.salesQty)} {it.uom}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">
                      {formatMoney(it.unitPrice)}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-600 dark:text-gray-400">
                      {it.taxRate}%
                    </td>
                    <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-white">
                      {formatMoney(it.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Breakdown Card */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 shadow-xs space-y-2">
          <div className="flex justify-between text-theme-sm text-gray-600 dark:text-gray-400">
            <span>Taxable Subtotal:</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {formatMoney(subtotal)}
            </span>
          </div>

          {!isInter ? (
            <>
              <div className="flex justify-between text-theme-sm text-gray-600 dark:text-gray-400">
                <span>Central GST (CGST):</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatMoney(cgstAmount)}
                </span>
              </div>
              <div className="flex justify-between text-theme-sm text-gray-600 dark:text-gray-400">
                <span>State GST (SGST):</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatMoney(sgstAmount)}
                </span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-theme-sm text-gray-600 dark:text-gray-400">
              <span>Integrated GST (IGST):</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatMoney(igstAmount)}
              </span>
            </div>
          )}

          <div className="border-t border-gray-100 pt-2 dark:border-gray-800 flex justify-between text-theme-base font-bold text-gray-900 dark:text-white">
            <span>Grand Total:</span>
            <span className="text-[#1769F5] dark:text-sky-400">
              {formatMoney(total)}
            </span>
          </div>
        </div>

        {/* Optional Narration Notes */}
        <FormField label="Invoice Notes / Narration">
          {(fieldProps) => (
            <Textarea
              {...fieldProps}
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional invoice notes or internal reference..."
            />
          )}
        </FormField>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={issueMutation.isPending}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            className="gap-2 bg-[#1769F5] hover:bg-[#1559d0] text-white"
            disabled={issueMutation.isPending}
          >
            <FileCheck className="h-4 w-4" />
            {issueMutation.isPending
              ? "Posting to Finance..."
              : "Confirm & Issue Invoice"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
