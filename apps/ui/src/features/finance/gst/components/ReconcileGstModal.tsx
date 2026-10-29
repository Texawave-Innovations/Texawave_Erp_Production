"use client";

import { useState } from "react";
import type {
  CounterpartGstEntryInput,
  FinanceGstReconciliationResult,
  GstReconciliationMatchStatus,
} from "@texawave-erp/api-types";
import {
  Alert,
  Button,
  Dialog,
  FormField,
  Input,
  StatusBadge,
  useToast,
} from "@texawave-erp/ui-kit";
import { AlertTriangle, FileCheck2, RotateCcw } from "lucide-react";
import { formatMoney } from "../../shared/format";
import { useReconcileGst } from "../hooks";
import { reconcileGstSchema } from "../schema";

export interface ReconcileGstModalProps {
  open: boolean;
  onClose: () => void;
  defaultPeriod?: string;
  onSuccess?: () => void;
}

const SAMPLE_GSTR2B_DATA: CounterpartGstEntryInput[] = [
  {
    gstin: "29AABCT1332L1ZV",
    invoiceNumber: "INV-2026-001",
    invoiceDate: "2026-10-05",
    taxableAmount: 50000,
    cgstAmount: 4500,
    sgstAmount: 4500,
    igstAmount: 0,
    totalTaxAmount: 9000,
  },
  {
    gstin: "27AABCT9981K1Z3",
    invoiceNumber: "BILL-2026-884",
    invoiceDate: "2026-10-12",
    taxableAmount: 120000,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 21600,
    totalTaxAmount: 21600,
  },
  {
    gstin: "07AABCS4455P1Z8",
    invoiceNumber: "SUPP-9921",
    invoiceDate: "2026-10-18",
    taxableAmount: 30000,
    cgstAmount: 2700,
    sgstAmount: 2700,
    igstAmount: 0,
    totalTaxAmount: 5400,
  },
];

export function ReconcileGstModal({
  open,
  onClose,
  defaultPeriod = "2026-10",
  onSuccess,
}: ReconcileGstModalProps) {
  const { toast } = useToast();
  const reconcileMutation = useReconcileGst();

  const [period, setPeriod] = useState(defaultPeriod);
  const [persistReconciliation, setPersistReconciliation] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [jsonInput, setJsonInput] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FinanceGstReconciliationResult | null>(
    null,
  );

  const handleClose = () => {
    if (submitting) return;
    setError(null);
    setResult(null);
    onClose();
  };

  const handleLoadSample = () => {
    setJsonInput(JSON.stringify(SAMPLE_GSTR2B_DATA, null, 2));
    setIsDemoMode(true);
    setPersistReconciliation(false);
    setError(null);
  };

  const handleJsonInputChange = (val: string) => {
    setJsonInput(val);
    if (isDemoMode) {
      setIsDemoMode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setError(null);

    if (!jsonInput.trim()) {
      setError("Please paste GSTR-2B counterpart records or load sample data.");
      return;
    }

    let parsedEntries: CounterpartGstEntryInput[];
    try {
      const raw = JSON.parse(jsonInput);
      if (!Array.isArray(raw)) {
        throw new Error("Payload must be a JSON array of counterpart entries.");
      }
      parsedEntries = raw.map((item: Record<string, unknown>) => ({
        gstin: String(item.gstin ?? "")
          .trim()
          .toUpperCase(),
        invoiceNumber: String(item.invoiceNumber ?? "").trim(),
        ...(item.invoiceDate ? { invoiceDate: String(item.invoiceDate) } : {}),
        taxableAmount: Number(item.taxableAmount ?? 0),
        ...(item.cgstAmount !== undefined
          ? { cgstAmount: Number(item.cgstAmount) }
          : {}),
        ...(item.sgstAmount !== undefined
          ? { sgstAmount: Number(item.sgstAmount) }
          : {}),
        ...(item.igstAmount !== undefined
          ? { igstAmount: Number(item.igstAmount) }
          : {}),
        totalTaxAmount: Number(item.totalTaxAmount ?? 0),
      }));
    } catch (parseErr: unknown) {
      setError(
        parseErr instanceof Error
          ? `JSON Parse Error: ${parseErr.message}`
          : "Invalid JSON format for counterpart entries.",
      );
      return;
    }

    // Safety guard: Demo data cannot be persisted to real database
    const shouldPersist = isDemoMode ? false : persistReconciliation;

    const payload = {
      period: period.trim(),
      persistReconciliation: shouldPersist,
      counterpartEntries: parsedEntries,
    };

    const validated = reconcileGstSchema.safeParse(payload);
    if (!validated.success) {
      setError(
        validated.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(", "),
      );
      return;
    }

    try {
      setSubmitting(true);
      const res = await reconcileMutation.mutateAsync(payload);
      setResult(res);
      toast({
        title: "Reconciliation Complete",
        description: `Compared ${res.totalBooksRecords} books records with ${res.totalPortalRecords} portal entries (${res.matchedCount} matched).`,
        variant: "success",
      });
      onSuccess?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to perform GST reconciliation.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const getMatchBadge = (status: GstReconciliationMatchStatus) => {
    switch (status) {
      case "MATCHED":
        return <StatusBadge label="Matched" colorToken="success" />;
      case "TAX_MISMATCH":
        return <StatusBadge label="Tax Mismatch" colorToken="warning" />;
      case "MISSING_IN_PORTAL":
        return <StatusBadge label="Missing in Portal" colorToken="error" />;
      case "MISSING_IN_BOOKS":
        return <StatusBadge label="Missing in Books" colorToken="brand" />;
      default:
        return <StatusBadge label={status} colorToken="gray" />;
    }
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2">
          <FileCheck2 className="h-5 w-5 text-[#1769F5] dark:text-sky-400" />
          <span>GSTR-2B Input Tax Credit (ITC) Reconciliation</span>
        </div>
      }
      size="3xl"
    >
      <div className="space-y-5 text-theme-sm relative focus-within:z-30">
        {error && (
          <Alert variant="error" title="Reconciliation Error">
            {error}
          </Alert>
        )}

        {!result ? (
          /* Step 1: Input Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              Cross-verify internal ERP purchase records against official
              counterparty filing data extracted from the GST Portal (Form
              GSTR-2B).
            </p>

            {/* Demo Mode Notice */}
            {isDemoMode && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-theme-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <span className="font-bold">DEMO MODE ACTIVE:</span> Synthetic
                  sample records are loaded for workflow verification. Database
                  persistence is locked to DISABLED so test data will never
                  alter real database entries.
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Reconciliation Period"
                required
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

              <div className="flex flex-col justify-center pt-2">
                <label
                  className={`flex items-center gap-2 text-theme-sm font-semibold ${
                    isDemoMode
                      ? "text-gray-400 cursor-not-allowed"
                      : "text-gray-700 dark:text-gray-300 cursor-pointer"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={persistReconciliation}
                    disabled={isDemoMode}
                    onChange={(e) => setPersistReconciliation(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-[#1769F5] focus:ring-[#1769F5]"
                  />
                  <span>Persist Reconciled Status in Database</span>
                </label>
                <span className="text-theme-xs text-gray-500 dark:text-gray-400 pl-6 mt-0.5">
                  {isDemoMode
                    ? "Locked to disabled while viewing demo data."
                    : persistReconciliation
                      ? "Matching books records will be updated from ACTIVE to RECONCILED."
                      : "Dry-run only: reports discrepancies without updating database records."}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-gray-800 dark:text-gray-200 text-theme-xs uppercase">
                  Counterparty GSTR-2B Data (JSON Array)
                </label>
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="text-theme-xs font-semibold text-[#1769F5] hover:text-blue-700 dark:text-sky-400 cursor-pointer"
                >
                  Load Synthetic Demo Data (Testing Only)
                </button>
              </div>
              <textarea
                rows={9}
                value={jsonInput}
                onChange={(e) => handleJsonInputChange(e.target.value)}
                placeholder='Paste JSON array from GSTR-2B export:&#10;[&#10;  {&#10;    "gstin": "29AABCT1332L1ZV",&#10;    "invoiceNumber": "INV-2026-001",&#10;    "taxableAmount": 50000,&#10;    "totalTaxAmount": 9000&#10;  }&#10;]'
                className="w-full rounded-xl border border-gray-300 bg-white p-3 text-theme-xs text-gray-900 shadow-xs focus:border-[#1769F5] focus:ring-1 focus:ring-[#1769F5] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
              <span className="text-theme-xs text-gray-500 dark:text-gray-400">
                Required per item: `gstin`, `invoiceNumber`, `taxableAmount`,
                and `totalTaxAmount`. Optional: `cgstAmount`, `sgstAmount`,
                `igstAmount`, `invoiceDate`.
              </span>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-200/80 dark:border-gray-800">
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
                Execute Reconciliation
              </Button>
            </div>
          </form>
        ) : (
          /* Step 2: Results View */
          <div className="space-y-5">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <span className="text-theme-xs font-bold text-emerald-700 uppercase dark:text-emerald-400">
                  Matched
                </span>
                <div className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-300 mt-1">
                  {result.matchedCount}
                </div>
              </div>

              <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3.5 dark:border-amber-900/40 dark:bg-amber-950/20">
                <span className="text-theme-xs font-bold text-amber-700 uppercase dark:text-amber-400">
                  Tax Mismatch
                </span>
                <div className="text-2xl font-extrabold text-amber-800 dark:text-amber-300 mt-1">
                  {result.taxMismatchCount}
                </div>
              </div>

              <div className="rounded-xl border border-rose-200/80 bg-rose-50/50 p-3.5 dark:border-rose-900/40 dark:bg-rose-950/20">
                <span className="text-theme-xs font-bold text-rose-700 uppercase dark:text-rose-400">
                  Missing in Portal
                </span>
                <div className="text-2xl font-extrabold text-rose-800 dark:text-rose-300 mt-1">
                  {result.missingInPortalCount}
                </div>
              </div>

              <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20">
                <span className="text-theme-xs font-bold text-blue-700 uppercase dark:text-sky-400">
                  Missing in Books
                </span>
                <div className="text-2xl font-extrabold text-blue-800 dark:text-sky-300 mt-1">
                  {result.missingInBooksCount}
                </div>
              </div>
            </div>

            {/* Financial Reconciliation Summary */}
            <div className="rounded-xl border border-gray-200/80 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/40">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-theme-sm">
                <div>
                  <span className="text-theme-xs text-gray-500 uppercase font-semibold">
                    Books ITC Available:
                  </span>
                  <div className="font-bold text-gray-900 dark:text-white">
                    {formatMoney(result.totalBooksItc)}
                  </div>
                </div>
                <div>
                  <span className="text-theme-xs text-gray-500 uppercase font-semibold">
                    GSTR-2B Portal ITC:
                  </span>
                  <div className="font-bold text-gray-900 dark:text-white">
                    {formatMoney(result.totalPortalItc)}
                  </div>
                </div>
                <div>
                  <span className="text-theme-xs text-gray-500 uppercase font-semibold">
                    Eligible Settled ITC:
                  </span>
                  <div className="font-bold text-[#1769F5] dark:text-sky-400">
                    {formatMoney(result.eligibleItc)}
                  </div>
                </div>
                <div>
                  <span className="text-theme-xs text-gray-500 uppercase font-semibold">
                    Database Updated:
                  </span>
                  <div className="font-bold text-gray-900 dark:text-white">
                    {result.reconciledEntriesUpdated} entries
                  </div>
                </div>
              </div>
            </div>

            {/* Discrepancies Table */}
            <div className="space-y-2">
              <h4 className="text-theme-xs font-bold text-gray-500 uppercase tracking-wider">
                Reconciliation Itemization & Discrepancies (
                {result.discrepancies.length})
              </h4>

              {result.discrepancies.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 text-center text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                  <span className="font-semibold">
                    All counterpart entries perfectly matched the ERP purchase
                    books with zero discrepancies!
                  </span>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200/80 dark:border-gray-800">
                  <table className="w-full border-collapse text-left text-theme-xs">
                    <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                      <tr>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Reference</th>
                        <th className="py-2.5 px-3">GSTIN</th>
                        <th className="py-2.5 px-3 text-right">Books Tax</th>
                        <th className="py-2.5 px-3 text-right">Portal Tax</th>
                        <th className="py-2.5 px-3 text-right">Diff</th>
                        <th className="py-2.5 px-3">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900">
                      {result.discrepancies.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="py-2 px-3">
                            {getMatchBadge(item.status)}
                          </td>
                          <td className="py-2 px-3 font-semibold text-gray-900 dark:text-white">
                            {item.invoiceReference}
                          </td>
                          <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                            {item.gstin}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {item.booksTaxAmount !== null
                              ? formatMoney(item.booksTaxAmount)
                              : "—"}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {item.portalTaxAmount !== null
                              ? formatMoney(item.portalTaxAmount)
                              : "—"}
                          </td>
                          <td
                            className={`py-2 px-3 text-right font-semibold ${
                              item.taxDifference > 0
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-gray-600"
                            }`}
                          >
                            {formatMoney(item.taxDifference)}
                          </td>
                          <td className="py-2 px-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">
                            {item.notes}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-gray-200/80 dark:border-gray-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setResult(null)}
                className="flex items-center gap-1.5"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Run Another Comparison</span>
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleClose}
                className="bg-[#1769F5] hover:bg-blue-700 text-white"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
