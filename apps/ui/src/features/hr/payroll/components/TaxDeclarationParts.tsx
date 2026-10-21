"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Coins,
  Download,
  FileText,
  Info,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Alert,
  Button,
  DataTable,
  FormField,
  Input,
  Select,
} from "@texawave-erp/ui-kit";
import { downloadForm16 } from "../api";
import { downloadBlob } from "../download";
import { describeError, money, periodLabel } from "../format";
import { useForm16 } from "../hooks";
import {
  DECLARATION_FIELDS,
  type DeclarationField,
  TAX_REGIMES,
  type TaxDeclaration,
  type TaxRegime,
} from "../types";
import { ServerError } from "./DialogParts";

export type DeclarationDraft = { regime: TaxRegime } & Record<
  DeclarationField,
  string
>;

export function declarationDraft(d: TaxDeclaration | null): DeclarationDraft {
  const out = { regime: d?.regime ?? "NEW" } as DeclarationDraft;
  for (const [k] of DECLARATION_FIELDS) {
    out[k] = d ? String(Number(d[k])) : "0";
  }
  return out;
}

/** Validates the draft; an error message or the amounts. */
export function declarationAmounts(
  draft: DeclarationDraft,
): { error: string } | { amounts: Record<DeclarationField, number> } {
  const amounts = {} as Record<DeclarationField, number>;
  for (const [k, label] of DECLARATION_FIELDS) {
    const text = (draft[k] ?? "").trim();
    const n = text === "" ? 0 : Number(text);
    if (!Number.isFinite(n) || n < 0) return { error: `${label}: ₹0 or more` };
    amounts[k] = n;
  }
  return { amounts };
}

/**
 * Intelligent, user-friendly Tax Declaration Fields component:
 * - Dynamic Regime-aware display (hides irrelevant Chapter VI-A fields in New Regime)
 * - Structured categories with statutory limit notes (80C, 80D, 24b) in Old Regime
 * - Real-time total declared deductions counter preview
 */
export function DeclarationFields({
  draft,
  onChange,
  disabled = false,
}: {
  draft: DeclarationDraft;
  onChange: (d: DeclarationDraft) => void;
  disabled?: boolean;
}) {
  const isNewRegime = draft.regime === "NEW";

  // Calculate live total deductions preview for Old Regime
  const totalDeductionsPreview = useMemo(() => {
    if (isNewRegime) return 75000; // Standard deduction
    const n80c = Math.min(150000, Number(draft.section80c || 0));
    const n80d = Number(draft.section80d || 0);
    const nhra = Number(draft.hraExemption || 0);
    const nhome = Math.min(200000, Number(draft.homeLoanInterest || 0));
    const nother = Number(draft.otherDeductions || 0);
    return n80c + n80d + nhra + nhome + nother + 50000; // +50k standard deduction
  }, [draft, isNewRegime]);

  function handleFieldChange(field: DeclarationField, val: string) {
    onChange({
      ...draft,
      [field]: val,
    });
  }

  return (
    <fieldset disabled={disabled} className="flex flex-col gap-5">
      {/* 1. Interactive Tax Regime Switcher */}
      <div>
        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
          Tax Regime Selection <span className="text-rose-500">*</span>
        </p>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* New Regime Option */}
          <button
            type="button"
            onClick={() => onChange({ ...draft, regime: "NEW" })}
            className={`flex flex-col rounded-xl border p-3.5 text-left transition-all ${
              isNewRegime
                ? "border-2 border-brand-500 bg-sky-50/60 shadow-xs ring-2 ring-brand-500/20 dark:border-brand-400 dark:bg-slate-800"
                : "border-gray-200 bg-white hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                New Tax Regime (Sec 115BAC)
              </span>
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-slate-700 dark:text-sky-300">
                Default
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Lower tax rates + standard deduction of ₹75,000. No investment
              receipts or proofs required.
            </p>
          </button>

          {/* Old Regime Option */}
          <button
            type="button"
            onClick={() => onChange({ ...draft, regime: "OLD" })}
            className={`flex flex-col rounded-xl border p-3.5 text-left transition-all ${
              !isNewRegime
                ? "border-2 border-brand-500 bg-sky-50/60 shadow-xs ring-2 ring-brand-500/20 dark:border-brand-400 dark:bg-slate-800"
                : "border-gray-200 bg-white hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Old Tax Regime (With Deductions)
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                Optional
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Higher slab rates but allows 80C, 80D, HRA, and Home Loan
              exemptions with proof verification.
            </p>
          </button>
        </div>
      </div>

      {/* 2. Regime-Aware Content */}
      {isNewRegime ? (
        /* New Regime Guidance Card */
        <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4 text-xs dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex items-center gap-2 font-bold text-brand-600 dark:text-sky-300">
            <CheckCircle2 className="h-4 w-4" />
            <span>Automatic Standard Deduction Applied</span>
          </div>
          <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
            Under the New Tax Regime, an automatic standard deduction of{" "}
            <strong>₹75,000</strong> is deducted from gross taxable salary.
            Chapter VI-A investments (80C, 80D, HRA, Home Loan Interest) do not
            apply and have been hidden to keep your declaration clean.
          </p>
        </div>
      ) : (
        /* Old Regime Structured Input Sections */
        <div className="flex flex-col gap-4">
          {/* Section A: Chapter VI-A Investments */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/40 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
                1. Chapter VI-A Investments & Medical
              </p>
              <span className="text-[11px] text-slate-500">
                Statutory Proofs Required
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                label="80C Investments (PPF, ELSS, EPF, LIC)"
                hint="Statutory maximum limit is ₹1,50,000 / year."
              >
                {(f) => (
                  <Input
                    {...f}
                    type="number"
                    min={0}
                    placeholder="0"
                    value={draft.section80c}
                    onChange={(e) =>
                      handleFieldChange("section80c", e.target.value)
                    }
                  />
                )}
              </FormField>

              <FormField
                label="80D Medical Insurance"
                hint="Up to ₹25,000 for self/family; up to ₹50,000 for parents."
              >
                {(f) => (
                  <Input
                    {...f}
                    type="number"
                    min={0}
                    placeholder="0"
                    value={draft.section80d}
                    onChange={(e) =>
                      handleFieldChange("section80d", e.target.value)
                    }
                  />
                )}
              </FormField>
            </div>
          </div>

          {/* Section B: Housing & Rent Relief */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/40 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
                2. Housing & Rent Relief
              </p>
              <span className="text-[11px] text-slate-500">
                Rent Receipts / Certificate
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                label="HRA Exemption Claim (₹ / year)"
                hint="Claimed house rent allowance exemption."
              >
                {(f) => (
                  <Input
                    {...f}
                    type="number"
                    min={0}
                    placeholder="0"
                    value={draft.hraExemption}
                    onChange={(e) =>
                      handleFieldChange("hraExemption", e.target.value)
                    }
                  />
                )}
              </FormField>

              <FormField
                label="Section 24(b) Home-Loan Interest"
                hint="Interest on self-occupied housing loan (Max ₹2,00,000)."
              >
                {(f) => (
                  <Input
                    {...f}
                    type="number"
                    min={0}
                    placeholder="0"
                    value={draft.homeLoanInterest}
                    onChange={(e) =>
                      handleFieldChange("homeLoanInterest", e.target.value)
                    }
                  />
                )}
              </FormField>
            </div>
          </div>

          {/* Section C: Additional Deductions */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/40 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
                3. Additional Chapter VI-A Deductions
              </p>
            </div>
            <FormField
              label="Other Deductions (80CCD, 80E, 80G, etc.)"
              hint="National Pension Scheme NPS, higher education loan interest, donations."
            >
              {(f) => (
                <Input
                  {...f}
                  type="number"
                  min={0}
                  placeholder="0"
                  value={draft.otherDeductions}
                  onChange={(e) =>
                    handleFieldChange("otherDeductions", e.target.value)
                  }
                />
              )}
            </FormField>
          </div>
        </div>
      )}

      {/* 3. Incomes from Other Sources & Previous Employment (Applies to both Regimes) */}
      <div className="rounded-xl border border-gray-200 bg-gray-50/40 p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
            Other Incomes & Previous Employment (If Applicable)
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <FormField
            label="Other Incomes (₹ / year)"
            hint="Bank interest, dividends, etc."
          >
            {(f) => (
              <Input
                {...f}
                type="number"
                min={0}
                placeholder="0"
                value={draft.otherIncome}
                onChange={(e) =>
                  handleFieldChange("otherIncome", e.target.value)
                }
              />
            )}
          </FormField>

          <FormField
            label="Previous Employer Income"
            hint="Taxable salary paid by earlier employer in current FY."
          >
            {(f) => (
              <Input
                {...f}
                type="number"
                min={0}
                placeholder="0"
                value={draft.previousEmployerIncome}
                onChange={(e) =>
                  handleFieldChange("previousEmployerIncome", e.target.value)
                }
              />
            )}
          </FormField>

          <FormField
            label="Previous Employer TDS"
            hint="TDS already deducted by earlier employer."
          >
            {(f) => (
              <Input
                {...f}
                type="number"
                min={0}
                placeholder="0"
                value={draft.previousEmployerTds}
                onChange={(e) =>
                  handleFieldChange("previousEmployerTds", e.target.value)
                }
              />
            )}
          </FormField>
        </div>
      </div>

      {/* 4. Live Total Declared Deductions Summary Banner */}
      <div className="flex items-center justify-between rounded-xl border border-sky-100 bg-sky-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/60">
        <div className="flex items-center gap-2 text-xs">
          <Coins className="h-4 w-4 text-brand-600 dark:text-sky-300" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Estimated Total Exemptions & Deductions:
          </span>
        </div>
        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
          {money(totalDeductionsPreview)}
        </span>
      </div>
    </fieldset>
  );
}

/**
 * Form 16 Part B for a year with PDF download.
 */
export function Form16View({
  financialYear,
  employeeId,
}: {
  financialYear: string;
  employeeId: number | null;
}) {
  const query = useForm16(financialYear, employeeId);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const f = query.data;

  async function download() {
    if (!f) return;
    setDownloading(true);
    setError(null);
    try {
      downloadBlob(
        `Form16-${f.employee.employeeCode}-${financialYear}.pdf`,
        await downloadForm16(financialYear, employeeId),
      );
    } catch (err) {
      setError(describeError(err));
    } finally {
      setDownloading(false);
    }
  }

  if (query.isPending) {
    return (
      <div className="py-8 text-center text-xs text-slate-500">
        Loading Form 16 Part B details…
      </div>
    );
  }

  if (query.isError) {
    return (
      <Alert variant="info" title="No Form 16 Available Yet">
        {describeError(query.error)}
      </Alert>
    );
  }

  if (!f) return null;
  const t = f.totals;

  return (
    <div className="flex flex-col gap-4">
      {/* Employee & Employer Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-100 bg-sky-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {f.employee.fullName} ({f.employee.employeeCode})
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            PAN: {f.employee.pan || "—"} · Regime: {f.regime}
          </p>
        </div>
        <div className="text-right text-xs">
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            {f.employer.name || "Employer"}
          </p>
          <p className="text-slate-400">TAN: {f.employer.tan || "—"}</p>
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="rounded-xl border border-gray-200 overflow-x-auto dark:border-slate-800">
        <DataTable
          caption={`Form 16 Monthly Earnings FY ${financialYear}`}
          rows={f.months}
          getRowKey={(r) => `${r.year}-${r.month}`}
          columns={[
            { header: "Month", cell: (r) => periodLabel(r) },
            {
              header: "Gross Earnings",
              cell: (r) => money(r.grossEarnings),
              className: "text-right",
              headerClassName: "text-right",
            },
            {
              header: "Taxable Earnings",
              cell: (r) => money(r.taxableEarnings),
              className: "text-right",
              headerClassName: "text-right",
            },
            {
              header: "TDS Deducted",
              cell: (r) => money(r.tds),
              className: "text-right",
              headerClassName: "text-right",
            },
          ]}
        />
      </div>

      {/* Annual Totals Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-sky-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Taxable Salary
          </p>
          <p className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
            {money(t.taxableSalary)}
          </p>
        </div>

        <div className="rounded-xl border border-amber-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
            Total Deductions
          </p>
          <p className="mt-0.5 text-base font-bold text-amber-600">
            {money(t.deductions)}
          </p>
        </div>

        <div className="rounded-xl border border-sky-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Net Taxable Income
          </p>
          <p className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
            {money(t.taxableIncome)}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            Total Tax Payable
          </p>
          <p className="mt-0.5 text-base font-bold text-emerald-600">
            {t.taxPayable === null ? "—" : money(t.taxPayable)}
          </p>
        </div>

        <div className="rounded-xl border border-blue-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
            TDS Deducted
          </p>
          <p className="mt-0.5 text-base font-bold text-blue-600">
            {money(t.tdsDeducted)}
          </p>
        </div>

        <div className="rounded-xl border border-sky-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Previous Employer TDS
          </p>
          <p className="mt-0.5 text-base font-bold text-slate-700 dark:text-slate-300">
            {money(t.previousEmployerTds)}
          </p>
        </div>
      </div>

      <ServerError message={error} />

      <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-slate-800">
        <span className="text-[11px] text-slate-400">
          Part B Certificate. Part A is issued via TRACES portal.
        </span>
        <Button
          variant="secondary"
          loading={downloading}
          onClick={() => void download()}
          className="text-xs font-semibold hover:border-brand-300"
        >
          <Download className="mr-1.5 h-3.5 w-3.5 text-brand-500" />
          Download Form 16 (PDF)
        </Button>
      </div>
    </div>
  );
}
