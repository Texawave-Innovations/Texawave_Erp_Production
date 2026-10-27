"use client";

import { useState } from "react";
import type {
  CreateFinanceGstEntryInput,
  FinanceGstEntryType,
  FinanceGstSourceType,
} from "@texawave-erp/api-types";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
  Select,
  useToast,
} from "@texawave-erp/ui-kit";
import { FilePlus2, Info } from "lucide-react";
import { useCreateGstEntry } from "../hooks";
import { createGstEntrySchema } from "../schema";

export interface AddGstEntryDialogProps {
  open: boolean;
  onClose: () => void;
  defaultPeriod?: string;
  onSuccess?: () => void;
}

interface AddGstEntryFormProps {
  defaultPeriod: string;
  onClose: () => void;
  onSuccess?: (() => void) | undefined;
}

function AddGstEntryForm({
  defaultPeriod,
  onClose,
  onSuccess,
}: AddGstEntryFormProps) {
  const { toast } = useToast();
  const createMutation = useCreateGstEntry();

  const [gstin, setGstin] = useState("");
  const [period, setPeriod] = useState(defaultPeriod);
  const [entryType, setEntryType] = useState<FinanceGstEntryType>("OUTPUT_GST");
  const [sourceType, setSourceType] = useState<FinanceGstSourceType>("MANUAL");
  const [sourceReference, setSourceReference] = useState("");
  const [hsnSacCode, setHsnSacCode] = useState("");
  const [taxableAmount, setTaxableAmount] = useState("");

  // Rate helpers
  const [supplyType, setSupplyType] = useState<"INTRA" | "INTER">("INTRA");
  const [presetRate, setPresetRate] = useState<number>(18);
  const [cgstRate, setCgstRate] = useState("9");
  const [cgstAmount, setCgstAmount] = useState("0");
  const [sgstRate, setSgstRate] = useState("9");
  const [sgstAmount, setSgstAmount] = useState("0");
  const [igstRate, setIgstRate] = useState("0");
  const [igstAmount, setIgstAmount] = useState("0");
  const [isProformaExcluded, setIsProformaExcluded] = useState(false);
  const [proformaAutoDetected, setProformaAutoDetected] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-calculate rates and tax breakdown when base amount, supply type, or preset rate changes
  const handleRecalculate = (
    baseAmtStr: string,
    mode: "INTRA" | "INTER",
    rate: number,
  ) => {
    const base = parseFloat(baseAmtStr);
    if (!Number.isFinite(base) || base <= 0) {
      setCgstAmount("0");
      setSgstAmount("0");
      setIgstAmount("0");
      return;
    }

    if (mode === "INTRA") {
      const halfRate = rate / 2;
      const halfTax = Number((base * (halfRate / 100)).toFixed(2));
      setCgstRate(String(halfRate));
      setCgstAmount(String(halfTax));
      setSgstRate(String(halfRate));
      setSgstAmount(String(halfTax));
      setIgstRate("0");
      setIgstAmount("0");
    } else {
      const fullTax = Number((base * (rate / 100)).toFixed(2));
      setIgstRate(String(rate));
      setIgstAmount(String(fullTax));
      setCgstRate("0");
      setCgstAmount("0");
      setSgstRate("0");
      setSgstAmount("0");
    }
  };

  const handleBaseAmountChange = (val: string) => {
    setTaxableAmount(val);
    handleRecalculate(val, supplyType, presetRate);
  };

  const handleSupplyTypeChange = (mode: "INTRA" | "INTER") => {
    setSupplyType(mode);
    handleRecalculate(taxableAmount, mode, presetRate);
  };

  const handlePresetRateChange = (rateVal: number) => {
    setPresetRate(rateVal);
    handleRecalculate(taxableAmount, supplyType, rateVal);
  };

  const handleReferenceChange = (val: string) => {
    setSourceReference(val);
    const upper = val.toUpperCase();
    if (
      upper.includes("/PI/") ||
      upper.includes("-PI-") ||
      upper.startsWith("PI-") ||
      upper.includes("PROFORMA")
    ) {
      setIsProformaExcluded(true);
      setProformaAutoDetected(true);
    } else if (proformaAutoDetected) {
      setProformaAutoDetected(false);
    }
  };

  const totalCalculatedTax =
    supplyType === "INTRA"
      ? (parseFloat(cgstAmount) || 0) + (parseFloat(sgstAmount) || 0)
      : parseFloat(igstAmount) || 0;

  const handleClose = () => {
    if (submitting) return;
    setErrors({});
    setSubmitError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitError(null);
    setErrors({});

    const parsedTaxable = parseFloat(taxableAmount);
    if (!Number.isFinite(parsedTaxable) || parsedTaxable <= 0) {
      setErrors((prev) => ({
        ...prev,
        taxableAmount: "Taxable base amount must be greater than zero.",
      }));
      return;
    }

    const parsedCgstRate = parseFloat(cgstRate) || 0;
    const parsedCgstAmount = parseFloat(cgstAmount) || 0;
    const parsedSgstRate = parseFloat(sgstRate) || 0;
    const parsedSgstAmount = parseFloat(sgstAmount) || 0;
    const parsedIgstRate = parseFloat(igstRate) || 0;
    const parsedIgstAmount = parseFloat(igstAmount) || 0;

    // Enforce intra vs inter jurisdictional exclusivity
    const finalCgstRate = supplyType === "INTRA" ? parsedCgstRate : 0;
    const finalCgstAmount =
      supplyType === "INTRA" ? Number(parsedCgstAmount.toFixed(2)) : 0;
    const finalSgstRate = supplyType === "INTRA" ? parsedSgstRate : 0;
    const finalSgstAmount =
      supplyType === "INTRA" ? Number(parsedSgstAmount.toFixed(2)) : 0;
    const finalIgstRate = supplyType === "INTER" ? parsedIgstRate : 0;
    const finalIgstAmount =
      supplyType === "INTER" ? Number(parsedIgstAmount.toFixed(2)) : 0;

    const totalTax = Number(
      (finalCgstAmount + finalSgstAmount + finalIgstAmount).toFixed(2),
    );

    const payload: CreateFinanceGstEntryInput = {
      gstin: gstin.trim().toUpperCase(),
      period: period.trim(),
      entryType,
      sourceType,
      sourceReference: sourceReference.trim(),
      ...(hsnSacCode.trim() ? { hsnSacCode: hsnSacCode.trim() } : {}),
      taxableAmount: Number(parsedTaxable.toFixed(2)),
      cgstRate: finalCgstRate,
      cgstAmount: finalCgstAmount,
      sgstRate: finalSgstRate,
      sgstAmount: finalSgstAmount,
      igstRate: finalIgstRate,
      igstAmount: finalIgstAmount,
      totalTaxAmount: totalTax,
      isProformaExcluded,
    };

    const result = createGstEntrySchema.safeParse(payload);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const fieldName = issue.path[0];
        if (fieldName && typeof fieldName === "string") {
          fieldErrors[fieldName] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    try {
      setSubmitting(true);
      await createMutation.mutateAsync(payload);
      toast({
        title: "GST Entry Recorded",
        description: `Successfully recorded ${entryType === "OUTPUT_GST" ? "outward liability" : "input tax credit"} entry for period ${period}.`,
        variant: "success",
      });
      onClose();
      onSuccess?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to record GST entry";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 text-theme-sm relative focus-within:z-30"
    >
      {submitError && (
        <Alert variant="error" title="Submission Failed">
          {submitError}
        </Alert>
      )}

      {/* Statutory Registry Guidance */}
      <div className="flex items-start gap-2.5 rounded-xl border border-blue-200/60 bg-blue-50/50 p-3 text-theme-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-sky-200">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-[#1769F5] dark:text-sky-400" />
        <span>
          Manual entries are recorded directly into the GST statutory tax ledger
          for returns compilation (GSTR-1, GSTR-3B). In accordance with
          accounting controls, manual GST registry entries do not create
          double-entry journal postings in the General Ledger.
        </span>
      </div>

      {/* Row 1: Entry Type & Period */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Entry Type" required error={errors.entryType}>
          {(fieldProps) => (
            <Select
              {...fieldProps}
              value={entryType}
              onChange={(e) =>
                setEntryType(e.target.value as FinanceGstEntryType)
              }
            >
              <option value="OUTPUT_GST">OUTPUT_GST (Outward Liability)</option>
              <option value="INPUT_TAX_CREDIT">
                INPUT_TAX_CREDIT (Inward Eligible ITC)
              </option>
            </Select>
          )}
        </FormField>

        <FormField
          label="Tax Period (YYYY-MM)"
          required
          error={errors.period}
          hint="Format: YYYY-MM (e.g. 2026-10)"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={period}
              placeholder="2026-10"
              maxLength={7}
              onChange={(e) => setPeriod(e.target.value)}
            />
          )}
        </FormField>
      </div>

      {/* Row 2: Counterparty GSTIN & Source Reference */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="Counterparty GSTIN"
          required
          error={errors.gstin}
          hint="15-character statutory format. Note: format validation does not confirm active portal registration."
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={gstin}
              placeholder="e.g. 29AABCT1332L1ZV"
              maxLength={15}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
            />
          )}
        </FormField>

        <FormField
          label="Invoice / Bill Reference"
          required
          error={errors.sourceReference}
          hint="Original invoice or voucher number"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={sourceReference}
              placeholder="e.g. INV-2026-0042"
              onChange={(e) => handleReferenceChange(e.target.value)}
            />
          )}
        </FormField>
      </div>

      {/* Proforma auto-detection callout */}
      {proformaAutoDetected && (
        <div className="flex items-center gap-2 rounded-xl bg-blue-50/70 p-2.5 text-theme-xs text-blue-700 dark:bg-blue-950/40 dark:text-sky-300 border border-blue-200/50">
          <Info className="h-4 w-4 shrink-0 text-blue-600" />
          <span>
            Proforma reference detected: This entry will be excluded from
            statutory GSTR-1 and GSTR-3B filings.
          </span>
        </div>
      )}

      {/* Row 3: Source Type & HSN / SAC Code */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="Source Document Type"
          required
          error={errors.sourceType}
        >
          {(fieldProps) => (
            <Select
              {...fieldProps}
              value={sourceType}
              onChange={(e) =>
                setSourceType(e.target.value as FinanceGstSourceType)
              }
            >
              <option value="MANUAL">Manual Adjustment Entry</option>
              <option value="SALES_INVOICE">Sales Tax Invoice</option>
              <option value="PURCHASE_BILL">Purchase Vendor Bill</option>
              <option value="EXPENSE">Operational Expense Voucher</option>
            </Select>
          )}
        </FormField>

        <FormField
          label="HSN / SAC Code"
          error={errors.hsnSacCode}
          hint="e.g. 998311 (IT Services) or 8471"
        >
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={hsnSacCode}
              placeholder="e.g. 998311"
              maxLength={20}
              onChange={(e) => setHsnSacCode(e.target.value)}
            />
          )}
        </FormField>
      </div>

      {/* Row 4: Taxable Base Amount & Rate Configurator */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 dark:border-blue-900/40 dark:bg-blue-950/20 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField
            label="Taxable Base Amount (₹)"
            required
            error={errors.taxableAmount}
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="number"
                step="0.01"
                min="0.01"
                value={taxableAmount}
                placeholder="0.00"
                onChange={(e) => handleBaseAmountChange(e.target.value)}
              />
            )}
          </FormField>

          <FormField label="Supply Jurisdiction" required>
            {() => (
              <Select
                value={supplyType}
                onChange={(e) =>
                  handleSupplyTypeChange(e.target.value as "INTRA" | "INTER")
                }
              >
                <option value="INTRA">Intra-State (CGST + SGST)</option>
                <option value="INTER">Inter-State (IGST)</option>
              </Select>
            )}
          </FormField>

          <FormField label="GST Rate Slab" required>
            {() => (
              <Select
                value={String(presetRate)}
                onChange={(e) =>
                  handlePresetRateChange(parseFloat(e.target.value))
                }
              >
                <option value="0">0% Nil Rated</option>
                <option value="5">5% Standard Low</option>
                <option value="12">12% Standard Concessional</option>
                <option value="18">18% Standard General</option>
                <option value="28">28% High Slab</option>
              </Select>
            )}
          </FormField>
        </div>

        {/* Breakdown Preview / Override */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-blue-200/60 dark:border-blue-900/40">
          <div>
            <label className="text-theme-xs font-semibold text-gray-700 dark:text-gray-300">
              CGST Amount ({cgstRate}%)
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={cgstAmount}
              disabled={supplyType === "INTER"}
              onChange={(e) => setCgstAmount(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-theme-xs font-semibold text-gray-700 dark:text-gray-300">
              SGST Amount ({sgstRate}%)
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={sgstAmount}
              disabled={supplyType === "INTER"}
              onChange={(e) => setSgstAmount(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-theme-xs font-semibold text-gray-700 dark:text-gray-300">
              IGST Amount ({igstRate}%)
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={igstAmount}
              disabled={supplyType === "INTRA"}
              onChange={(e) => setIgstAmount(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <div className="flex justify-between items-center pt-2 text-theme-sm font-bold text-gray-900 dark:text-white">
          <span>Total Calculated GST Tax:</span>
          <span className="text-[#1769F5] dark:text-sky-400 text-base">
            ₹{totalCalculatedTax.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Row 5: Proforma Exclusion Flag */}
      <div className="flex items-start gap-2.5 rounded-xl border border-gray-200/80 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-800/40">
        <input
          id="isProformaExcluded"
          type="checkbox"
          checked={isProformaExcluded}
          onChange={(e) => setIsProformaExcluded(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-[#1769F5] focus:ring-[#1769F5]"
        />
        <label
          htmlFor="isProformaExcluded"
          className="text-theme-xs text-gray-600 dark:text-gray-400 cursor-pointer"
        >
          <span className="font-semibold text-gray-800 dark:text-gray-200">
            Proforma Invoice Exclusion
          </span>{" "}
          — Check this if this record is a non-taxable proforma invoice or
          estimate. It will be excluded from statutory GSTR-1 and GSTR-3B
          filings per GST compliance laws.
        </label>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200/80 dark:border-gray-800">
        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          className="bg-[#1769F5] hover:bg-blue-700 text-white"
        >
          Record Entry
        </Button>
      </div>
    </form>
  );
}

export function AddGstEntryDialog({
  open,
  onClose,
  defaultPeriod = "2026-10",
  onSuccess,
}: AddGstEntryDialogProps) {
  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <FilePlus2 className="h-5 w-5 text-[#1769F5] dark:text-sky-400" />
          <span>Record GST Tax Ledger Entry</span>
        </div>
      }
      size="2xl"
    >
      <AddGstEntryForm
        defaultPeriod={defaultPeriod}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </Dialog>
  );
}
