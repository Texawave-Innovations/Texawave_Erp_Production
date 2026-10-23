"use client";

import {
  Alert,
  Button,
  Card,
  Checkbox,
  DataTable,
  Dialog,
  EmptyState,
  FormField,
  Input,
  Select,
  useToast,
} from "@texawave-erp/ui-kit";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  Calculator,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  Edit3,
  Filter,
  HelpCircle,
  Info,
  Layers,
  MapPin,
  Percent,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useWorkLocations } from "@/features/hr/holidays/hooks";
import { usePermission } from "@/hooks/usePermission";
import type { TaxRegimeBody } from "../api";
import {
  MONTH_OPTIONS,
  describeError,
  isoDate,
  money,
  recentFinancialYears,
} from "../format";
import {
  useCreatePtSlab,
  usePtLocationStates,
  usePtSlabs,
  useSaveTaxRegime,
  useSetPtLocationState,
  useTaxRegimes,
  useUpdatePtSlab,
} from "../hooks";
import { PAYROLL_SETTINGS_WRITE } from "../permissions";
import {
  type PtSlab,
  TAX_REGIMES,
  type TaxRegime,
  type TaxRegimeRules,
} from "../types";
import { DialogActions, ServerError } from "./DialogParts";
import { StatusPill } from "./PayrollStatusBadge";
import { QueryState } from "./QueryState";
import { TaxSlabsGuideDialog } from "./TaxSlabsGuideDialog";

// ============================================================================
// Indian States & Statutory Master Data
// ============================================================================

export const INDIAN_STATES: ReadonlyArray<{ code: string; name: string }> = [
  { code: "TN", name: "Tamil Nadu" },
  { code: "KA", name: "Karnataka" },
  { code: "MH", name: "Maharashtra" },
  { code: "TS", name: "Telangana" },
  { code: "AP", name: "Andhra Pradesh" },
  { code: "WB", name: "West Bengal" },
  { code: "GJ", name: "Gujarat" },
  { code: "KL", name: "Kerala" },
  { code: "DL", name: "Delhi" },
  { code: "HR", name: "Haryana" },
  { code: "UP", name: "Uttar Pradesh" },
  { code: "MP", name: "Madhya Pradesh" },
  { code: "RJ", name: "Rajasthan" },
  { code: "PB", name: "Punjab" },
  { code: "OD", name: "Odisha" },
  { code: "BR", name: "Bihar" },
  { code: "JH", name: "Jharkhand" },
  { code: "CH", name: "Chandigarh" },
  { code: "PY", name: "Puducherry" },
  { code: "GA", name: "Goa" },
  { code: "AS", name: "Assam" },
  { code: "UT", name: "Uttarakhand" },
  { code: "HP", name: "Himachal Pradesh" },
  { code: "CG", name: "Chhattisgarh" },
];

export const STATE_NAME_BY_CODE = new Map(
  INDIAN_STATES.map((s) => [s.code, s.name]),
);

export interface PtStatePreset {
  stateCode: string;
  stateName: string;
  description: string;
  slabs: Array<{
    minMonthlyWage: number;
    maxMonthlyWage: number | null;
    monthlyAmount: number;
    specialMonth?: number;
    specialAmount?: number;
    applicableMonths?: number[];
  }>;
}

export const PT_STATE_PRESETS: PtStatePreset[] = [
  {
    stateCode: "KA",
    stateName: "Karnataka",
    description:
      "₹200/mo for monthly gross ₹25,000 and above (Nil below ₹25,000). Total ₹2,400/yr.",
    slabs: [
      { minMonthlyWage: 0, maxMonthlyWage: 24999, monthlyAmount: 0 },
      { minMonthlyWage: 25000, maxMonthlyWage: null, monthlyAmount: 200 },
    ],
  },
  {
    stateCode: "MH",
    stateName: "Maharashtra",
    description:
      "Monthly ₹200 (Feb: ₹300) for gross > ₹10,000. Total statutory ₹2,500/yr.",
    slabs: [
      { minMonthlyWage: 0, maxMonthlyWage: 7500, monthlyAmount: 0 },
      { minMonthlyWage: 7501, maxMonthlyWage: 10000, monthlyAmount: 175 },
      {
        minMonthlyWage: 10001,
        maxMonthlyWage: null,
        monthlyAmount: 200,
        specialMonth: 2,
        specialAmount: 300,
      },
    ],
  },
  {
    stateCode: "TN",
    stateName: "Tamil Nadu",
    description:
      "Half-yearly deduction in Sep & Feb up to ₹1,250/period (Max ₹2,500/yr).",
    slabs: [
      {
        minMonthlyWage: 0,
        maxMonthlyWage: 21000,
        monthlyAmount: 0,
        applicableMonths: [9, 2],
      },
      {
        minMonthlyWage: 21001,
        maxMonthlyWage: 30000,
        monthlyAmount: 135,
        applicableMonths: [9, 2],
      },
      {
        minMonthlyWage: 30001,
        maxMonthlyWage: 45000,
        monthlyAmount: 315,
        applicableMonths: [9, 2],
      },
      {
        minMonthlyWage: 45001,
        maxMonthlyWage: 60000,
        monthlyAmount: 690,
        applicableMonths: [9, 2],
      },
      {
        minMonthlyWage: 60001,
        maxMonthlyWage: 75000,
        monthlyAmount: 1025,
        applicableMonths: [9, 2],
      },
      {
        minMonthlyWage: 75001,
        maxMonthlyWage: null,
        monthlyAmount: 1250,
        applicableMonths: [9, 2],
      },
    ],
  },
  {
    stateCode: "TS",
    stateName: "Telangana",
    description: "Monthly deduction: ₹150 for ₹15k–₹20k; ₹200 for > ₹20k.",
    slabs: [
      { minMonthlyWage: 0, maxMonthlyWage: 15000, monthlyAmount: 0 },
      { minMonthlyWage: 15001, maxMonthlyWage: 20000, monthlyAmount: 150 },
      { minMonthlyWage: 20001, maxMonthlyWage: null, monthlyAmount: 200 },
    ],
  },
  {
    stateCode: "AP",
    stateName: "Andhra Pradesh",
    description: "Monthly deduction: ₹150 for ₹15k–₹20k; ₹200 for > ₹20k.",
    slabs: [
      { minMonthlyWage: 0, maxMonthlyWage: 15000, monthlyAmount: 0 },
      { minMonthlyWage: 15001, maxMonthlyWage: 20000, monthlyAmount: 150 },
      { minMonthlyWage: 20001, maxMonthlyWage: null, monthlyAmount: 200 },
    ],
  },
  {
    stateCode: "WB",
    stateName: "West Bengal",
    description:
      "Graduated monthly rates from ₹110 to ₹200 for gross > ₹10,000.",
    slabs: [
      { minMonthlyWage: 0, maxMonthlyWage: 10000, monthlyAmount: 0 },
      { minMonthlyWage: 10001, maxMonthlyWage: 15000, monthlyAmount: 110 },
      { minMonthlyWage: 15001, maxMonthlyWage: 25000, monthlyAmount: 130 },
      { minMonthlyWage: 25001, maxMonthlyWage: 40000, monthlyAmount: 150 },
      { minMonthlyWage: 40001, maxMonthlyWage: null, monthlyAmount: 200 },
    ],
  },
  {
    stateCode: "GJ",
    stateName: "Gujarat",
    description: "Flat ₹200/month for monthly gross above ₹12,000.",
    slabs: [
      { minMonthlyWage: 0, maxMonthlyWage: 12000, monthlyAmount: 0 },
      { minMonthlyWage: 12001, maxMonthlyWage: null, monthlyAmount: 200 },
    ],
  },
];

export const STATUTORY_TAX_PRESETS: Record<
  TaxRegime,
  {
    standardDeduction: number;
    rebateIncomeLimit: number;
    rebateMaxAmount: number;
    cessPercent: number;
    section80cLimit: number;
    homeLoanInterestLimit: number;
    slabs: Array<{
      fromIncome: number;
      toIncome: number | null;
      ratePercent: number;
    }>;
  }
> = {
  NEW: {
    standardDeduction: 75000,
    rebateIncomeLimit: 700000,
    rebateMaxAmount: 25000,
    cessPercent: 4,
    section80cLimit: 0,
    homeLoanInterestLimit: 0,
    slabs: [
      { fromIncome: 0, toIncome: 300000, ratePercent: 0 },
      { fromIncome: 300000, toIncome: 700000, ratePercent: 5 },
      { fromIncome: 700000, toIncome: 1000000, ratePercent: 10 },
      { fromIncome: 1000000, toIncome: 1200000, ratePercent: 15 },
      { fromIncome: 1200000, toIncome: 1500000, ratePercent: 20 },
      { fromIncome: 1500000, toIncome: null, ratePercent: 30 },
    ],
  },
  OLD: {
    standardDeduction: 50000,
    rebateIncomeLimit: 500000,
    rebateMaxAmount: 12500,
    cessPercent: 4,
    section80cLimit: 150000,
    homeLoanInterestLimit: 200000,
    slabs: [
      { fromIncome: 0, toIncome: 250000, ratePercent: 0 },
      { fromIncome: 250000, toIncome: 500000, ratePercent: 5 },
      { fromIncome: 500000, toIncome: 1000000, ratePercent: 20 },
      { fromIncome: 1000000, toIncome: null, ratePercent: 30 },
    ],
  },
};

// ============================================================================
// Interactive TDS Salary Comparison Simulator
// ============================================================================

function TaxTdsSimulator({ onClose }: { onClose?: () => void }) {
  const [grossInput, setGrossInput] = useState("1200000");
  const [sec80c, setSec80c] = useState("150000");
  const [sec80d, setSec80d] = useState("25000");
  const [homeLoan, setHomeLoan] = useState("0");

  const gross = Math.max(0, Number(grossInput) || 0);
  const c80 = Math.min(150000, Math.max(0, Number(sec80c) || 0));
  const d80 = Math.min(100000, Math.max(0, Number(sec80d) || 0));
  const hl = Math.min(200000, Math.max(0, Number(homeLoan) || 0));

  // Compute New Regime Tax
  const newStdDed = 75000;
  const newTaxable = Math.max(0, gross - newStdDed);
  let newTaxBeforeRebate = 0;
  if (newTaxable > 1500000) {
    newTaxBeforeRebate += (newTaxable - 1500000) * 0.3;
    newTaxBeforeRebate += 300000 * 0.2; // 12L-15L
    newTaxBeforeRebate += 200000 * 0.15; // 10L-12L
    newTaxBeforeRebate += 300000 * 0.1; // 7L-10L
    newTaxBeforeRebate += 400000 * 0.05; // 3L-7L
  } else if (newTaxable > 1200000) {
    newTaxBeforeRebate += (newTaxable - 1200000) * 0.2;
    newTaxBeforeRebate += 200000 * 0.15;
    newTaxBeforeRebate += 300000 * 0.1;
    newTaxBeforeRebate += 400000 * 0.05;
  } else if (newTaxable > 1000000) {
    newTaxBeforeRebate += (newTaxable - 1000000) * 0.15;
    newTaxBeforeRebate += 300000 * 0.1;
    newTaxBeforeRebate += 400000 * 0.05;
  } else if (newTaxable > 700000) {
    newTaxBeforeRebate += (newTaxable - 700000) * 0.1;
    newTaxBeforeRebate += 400000 * 0.05;
  } else if (newTaxable > 300000) {
    newTaxBeforeRebate += (newTaxable - 300000) * 0.05;
  }
  // 87A rebate for New Regime (taxable income up to 7L)
  const newNetTax =
    newTaxable <= 700000
      ? 0
      : Math.round(newTaxBeforeRebate + newTaxBeforeRebate * 0.04);
  const newMonthlyTds = Math.round(newNetTax / 12);

  // Compute Old Regime Tax
  const oldStdDed = 50000;
  const oldDeductions = oldStdDed + c80 + d80 + hl;
  const oldTaxable = Math.max(0, gross - oldDeductions);
  let oldTaxBeforeRebate = 0;
  if (oldTaxable > 1000000) {
    oldTaxBeforeRebate += (oldTaxable - 1000000) * 0.3;
    oldTaxBeforeRebate += 500000 * 0.2; // 5L-10L
    oldTaxBeforeRebate += 250000 * 0.05; // 2.5L-5L
  } else if (oldTaxable > 500000) {
    oldTaxBeforeRebate += (oldTaxable - 500000) * 0.2;
    oldTaxBeforeRebate += 250000 * 0.05;
  } else if (oldTaxable > 250000) {
    oldTaxBeforeRebate += (oldTaxable - 250000) * 0.05;
  }
  // 87A rebate for Old Regime (taxable income up to 5L)
  const oldNetTax =
    oldTaxable <= 500000
      ? 0
      : Math.round(oldTaxBeforeRebate + oldTaxBeforeRebate * 0.04);
  const oldMonthlyTds = Math.round(oldNetTax / 12);

  const diff = Math.abs(oldNetTax - newNetTax);
  const newSaves = newNetTax < oldNetTax;
  const oldSaves = oldNetTax < newNetTax;

  return (
    <div className="rounded-2xl border border-sky-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-600 dark:border-slate-700 dark:bg-slate-800 dark:text-sky-400">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0a3271] dark:text-white">
              Interactive Income Tax & TDS Simulator (FY 2026-27)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live side-by-side tax comparison between New (Sec 115BAC) and Old
              Tax Regimes.
            </p>
          </div>
        </div>
        {onClose && (
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Inputs Bar */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Annual Gross CTC (₹)
          </label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              ₹
            </span>
            <input
              type="number"
              min={0}
              step={50000}
              value={grossInput}
              onChange={(e) => setGrossInput(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2 pl-7 pr-3 text-xs font-bold text-slate-900 outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {["600000", "900000", "1200000", "1500000", "2000000"].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setGrossInput(v)}
                className="rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-sky-50 hover:text-brand-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                ₹{Number(v) / 100000}L
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Section 80C (Old Regime)
          </label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              ₹
            </span>
            <input
              type="number"
              min={0}
              max={150000}
              value={sec80c}
              onChange={(e) => setSec80c(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2 pl-7 pr-3 text-xs font-semibold text-slate-900 outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            EPF, ELSS, PPF (Max ₹1.5L)
          </p>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Section 80D (Health Ins.)
          </label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              ₹
            </span>
            <input
              type="number"
              min={0}
              max={100000}
              value={sec80d}
              onChange={(e) => setSec80d(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2 pl-7 pr-3 text-xs font-semibold text-slate-900 outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            Self/Family health insurance
          </p>
        </div>

        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            Sec 24b Home Loan / HRA
          </label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              ₹
            </span>
            <input
              type="number"
              min={0}
              max={200000}
              value={homeLoan}
              onChange={(e) => setHomeLoan(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2 pl-7 pr-3 text-xs font-semibold text-slate-900 outline-none focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            Housing loan interest (Max ₹2L)
          </p>
        </div>
      </div>

      {/* Recommendation Banner */}
      <div className="mt-4 flex items-center justify-between rounded-xl border border-sky-100 bg-sky-50/50 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-brand-600 dark:text-sky-400" />
          <span className="font-bold text-[#0a3271] dark:text-sky-300">
            {newSaves
              ? `New Regime is more beneficial: saves ${money(String(diff))} / year in tax!`
              : oldSaves
                ? `Old Regime is more beneficial: saves ${money(String(diff))} / year with declarations!`
                : "Both regimes yield identical net tax for this income level."}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-slate-500">
          Monthly TDS delta: {money(String(Math.round(diff / 12)))}/mo
        </span>
      </div>

      {/* Comparison Cards Grid */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* New Regime Breakdown */}
        <div className="rounded-xl border border-brand-200 bg-brand-50/20 p-4 dark:border-brand-900/40 dark:bg-brand-950/20">
          <div className="flex items-center justify-between border-b border-brand-100 pb-2 dark:border-slate-800">
            <div>
              <span className="rounded-md bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-slate-800 dark:text-sky-300">
                Default Regime
              </span>
              <h4 className="mt-1 text-xs font-bold text-[#0a3271] dark:text-white">
                New Tax Regime (Sec 115BAC)
              </h4>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500">Net Annual Tax</span>
              <p className="text-base font-bold text-brand-600 dark:text-sky-400">
                {money(String(newNetTax))}
              </p>
            </div>
          </div>
          <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>Gross CTC:</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {money(String(gross))}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Standard Deduction:</span>
              <span className="font-semibold text-emerald-600">-₹75,000</span>
            </div>
            <div className="flex justify-between">
              <span>Taxable Income:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {money(String(newTaxable))}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Monthly TDS:</span>
              <span className="font-bold text-brand-600 dark:text-sky-400">
                {money(String(newMonthlyTds))}/mo
              </span>
            </div>
            {newTaxable <= 700000 && gross > 0 && (
              <p className="text-[11px] font-semibold text-emerald-600 mt-1">
                ✓ Full 87A rebate applied: Nil tax liability up to ₹7.75L CTC.
              </p>
            )}
          </div>
        </div>

        {/* Old Regime Breakdown */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2 dark:border-slate-800">
            <div>
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Optional Regime
              </span>
              <h4 className="mt-1 text-xs font-bold text-slate-900 dark:text-white">
                Old Tax Regime (With Deductions)
              </h4>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500">Net Annual Tax</span>
              <p className="text-base font-bold text-slate-900 dark:text-white">
                {money(String(oldNetTax))}
              </p>
            </div>
          </div>
          <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex justify-between">
              <span>Gross CTC:</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {money(String(gross))}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total Exemptions (Std + 80C/D/24b):</span>
              <span className="font-semibold text-emerald-600">
                -{money(String(oldDeductions))}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Taxable Income:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {money(String(oldTaxable))}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Monthly TDS:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {money(String(oldMonthlyTds))}/mo
              </span>
            </div>
            {oldTaxable <= 500000 && gross > 0 && (
              <p className="text-[11px] font-semibold text-emerald-600 mt-1">
                ✓ Full 87A rebate applied: Nil tax liability up to ₹5L taxable
                income.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Professional Tax Statutory Reference Guide Modal
// ============================================================================

function PtStatutoryGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      open
      onClose={onClose}
      title="Professional Tax (PT) Statutory Rules & State Calendars"
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-4 text-xs">
        <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-600 dark:text-sky-400" />
            <h4 className="font-bold text-[#0a3271] dark:text-white">
              Article 276(2) of the Constitution of India
            </h4>
          </div>
          <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
            Professional Tax is a state-level statutory levy on salaried
            employees and professionals. By constitutional mandate under Article
            276(2), the total professional tax payable in respect of any one
            person to a state or municipality shall{" "}
            <strong>not exceed ₹2,500 per annum</strong>.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h4 className="font-bold text-[#0a3271] dark:text-sky-300 uppercase tracking-wider text-[11px] mb-3">
            State-Specific Deduction Calendars
          </h4>
          <div className="divide-y divide-gray-100 dark:divide-slate-800 space-y-2 text-xs">
            <div className="pt-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white">
                  Tamil Nadu (TN)
                </span>
                <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-slate-800 dark:text-amber-300">
                  Half-Yearly (Sep & Feb)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Deducted semi-annually in the September and February payroll
                runs based on half-yearly gross wages (max ₹1,250 per period;
                ₹2,500/yr).
              </p>
            </div>

            <div className="pt-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white">
                  Karnataka (KA)
                </span>
                <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-brand-700 dark:bg-slate-800 dark:text-sky-300">
                  Monthly (₹200)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Deducted monthly at ₹200 for employees with monthly gross wages
                ₹25,000 and above (threshold revised from ₹15,000 in 2023).
                Total ₹2,400/yr.
              </p>
            </div>

            <div className="pt-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white">
                  Maharashtra (MH)
                </span>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-slate-800 dark:text-emerald-300">
                  Monthly + Feb ₹300
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                ₹200 deducted every month for wages &gt; ₹10,000, with an extra
                ₹100 deducted in February (₹300) to reach the exact ₹2,500
                annual limit.
              </p>
            </div>

            <div className="pt-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white">
                  Telangana & Andhra Pradesh
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Monthly Slabs
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Nil up to ₹15,000; ₹150 for ₹15,001–₹20,000; ₹200 for wages
                above ₹20,000.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
          <strong>Employer Responsibility:</strong> PT deducted from employees
          must be remitted to the respective state commercial tax portal on or
          before the statutory due date (typically 10th or 15th of the following
          month).
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="secondary" onClick={onClose}>
            Close Guide
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

// ============================================================================
// Income-Tax Regimes Section
// ============================================================================

interface SlabDraft {
  key: number;
  from: string;
  to: string;
  rate: string;
}
let slabKey = 1;

const AMOUNT_FIELDS = [
  ["standardDeduction", "Standard deduction (₹)"],
  ["rebateIncomeLimit", "87A rebate: income up to (₹)"],
  ["rebateMaxAmount", "87A rebate: at most (₹)"],
  ["cessPercent", "Cess (%)"],
  ["section80cLimit", "80C limit, old regime (₹)"],
  ["homeLoanInterestLimit", "Home-loan interest limit, old regime (₹)"],
] as const;
type AmountField = (typeof AMOUNT_FIELDS)[number][0];

function RegimeDialog({
  financialYear,
  regime,
  current,
  onClose,
}: {
  financialYear: string;
  regime: TaxRegime;
  current: TaxRegimeRules | null;
  onClose: () => void;
}) {
  const save = useSaveTaxRegime();
  const { toast } = useToast();
  const [amounts, setAmounts] = useState<Record<AmountField, string>>(() => {
    const out = {} as Record<AmountField, string>;
    for (const [k] of AMOUNT_FIELDS) {
      out[k] = current
        ? String(Number(current[k]))
        : k === "cessPercent"
          ? "4"
          : k === "section80cLimit"
            ? regime === "NEW"
              ? "0"
              : "150000"
            : k === "homeLoanInterestLimit"
              ? regime === "NEW"
                ? "0"
                : "200000"
              : k === "standardDeduction"
                ? regime === "NEW"
                  ? "75000"
                  : "50000"
                : k === "rebateIncomeLimit"
                  ? regime === "NEW"
                    ? "700000"
                    : "500000"
                  : k === "rebateMaxAmount"
                    ? regime === "NEW"
                      ? "25000"
                      : "12500"
                    : "0";
    }
    return out;
  });

  const [slabs, setSlabs] = useState<SlabDraft[]>(
    current?.slabs.map((s) => ({
      key: slabKey++,
      from: String(Number(s.fromIncome)),
      to: s.toIncome === null ? "" : String(Number(s.toIncome)),
      rate: String(Number(s.ratePercent)),
    })) ??
      (STATUTORY_TAX_PRESETS[regime]?.slabs.map((s) => ({
        key: slabKey++,
        from: String(s.fromIncome),
        to: s.toIncome === null ? "" : String(s.toIncome),
        rate: String(s.ratePercent),
      })) || [{ key: slabKey++, from: "0", to: "", rate: "0" }]),
  );

  const [error, setError] = useState<string | null>(null);

  const updateSlab = (key: number, patch: Partial<SlabDraft>) =>
    setSlabs((ss) => ss.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  const handleApplyPreset = () => {
    const p = STATUTORY_TAX_PRESETS[regime];
    setAmounts({
      standardDeduction: String(p.standardDeduction),
      rebateIncomeLimit: String(p.rebateIncomeLimit),
      rebateMaxAmount: String(p.rebateMaxAmount),
      cessPercent: String(p.cessPercent),
      section80cLimit: String(p.section80cLimit),
      homeLoanInterestLimit: String(p.homeLoanInterestLimit),
    });
    setSlabs(
      p.slabs.map((s) => ({
        key: slabKey++,
        from: String(s.fromIncome),
        to: s.toIncome === null ? "" : String(s.toIncome),
        rate: String(s.ratePercent),
      })),
    );
    toast({
      title: `Populated Finance Act standard slabs for ${regime} regime`,
      variant: "success",
    });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body: TaxRegimeBody = {
      financialYear,
      regime,
      version: current?.version ?? 0,
      standardDeduction: Number(amounts.standardDeduction),
      rebateIncomeLimit: Number(amounts.rebateIncomeLimit),
      rebateMaxAmount: Number(amounts.rebateMaxAmount),
      cessPercent: Number(amounts.cessPercent),
      section80cLimit: Number(amounts.section80cLimit),
      homeLoanInterestLimit: Number(amounts.homeLoanInterestLimit),
      slabs: slabs.map((s) => ({
        fromIncome: Number(s.from),
        toIncome: s.to.trim() === "" ? null : Number(s.to),
        ratePercent: Number(s.rate),
      })),
    };
    if (
      AMOUNT_FIELDS.some(
        ([k]) => amounts[k].trim() === "" || !(Number(amounts[k]) >= 0),
      )
    )
      return setError("Every amount must be a number of 0 or more");
    if (
      body.slabs.some(
        (s) =>
          !Number.isFinite(s.fromIncome) || !Number.isFinite(s.ratePercent),
      )
    )
      return setError("Every slab needs a start and a rate");
    setError(null);
    try {
      await save.mutateAsync(body);
      toast({
        title: `${regime} regime for FY ${financialYear} saved successfully`,
        variant: "success",
      });
      onClose();
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${regime} Tax Regime — FY ${financialYear}`}
      className="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        {/* Top Preset Helper */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-sky-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand-600 dark:text-sky-400" />
              <h4 className="text-xs font-bold text-[#0a3271] dark:text-white">
                Statutory Finance Act Guidelines
              </h4>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Enter contiguous slabs starting at 0. Leave the final slab&apos;s
              upper limit empty for highest tax bracket.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleApplyPreset}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#0a3271] dark:text-sky-300"
          >
            <RotateCcw className="h-3.5 w-3.5 text-brand-600" />
            Load Finance Act Presets
          </Button>
        </div>

        {/* Deductions & Rebates */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#0a3271] dark:text-sky-300 mb-2.5">
            Deductions, Rebates & Cess
          </h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AMOUNT_FIELDS.map(([k, label]) => (
              <FormField key={k} label={label}>
                {(f) => (
                  <Input
                    {...f}
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={amounts[k]}
                    onChange={(e) =>
                      setAmounts((a) => ({ ...a, [k]: e.target.value }))
                    }
                    className="font-semibold"
                  />
                )}
              </FormField>
            ))}
          </div>
        </div>

        {/* Contiguous Slabs */}
        <fieldset className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <legend className="text-xs font-bold uppercase tracking-wider text-[#0a3271] dark:text-sky-300">
              Annual Taxable Income Slabs
            </legend>
            <span className="text-[11px] text-slate-500">
              {slabs.length} slabs configured
            </span>
          </div>

          <div className="space-y-2 rounded-2xl border border-gray-200 bg-gray-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
            {slabs.map((s, i) => (
              <div
                key={s.key}
                className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2.5 shadow-2xs dark:bg-slate-800"
              >
                <span className="w-16 text-xs font-bold text-slate-500">
                  Slab {i + 1}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400">₹</span>
                  <Input
                    aria-label={`Slab ${i + 1} from`}
                    className="w-32 font-semibold text-xs"
                    type="number"
                    min={0}
                    value={s.from}
                    onChange={(e) =>
                      updateSlab(s.key, { from: e.target.value })
                    }
                  />
                </div>
                <span className="text-xs text-slate-400">to</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-400">₹</span>
                  <Input
                    aria-label={`Slab ${i + 1} to`}
                    className="w-32 font-semibold text-xs"
                    type="number"
                    min={0}
                    placeholder="No upper limit"
                    value={s.to}
                    onChange={(e) => updateSlab(s.key, { to: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-1 ml-auto">
                  <Input
                    aria-label={`Slab ${i + 1} rate`}
                    className="w-20 font-bold text-xs text-brand-600 dark:text-sky-400 text-right"
                    type="number"
                    min={0}
                    max={100}
                    value={s.rate}
                    onChange={(e) =>
                      updateSlab(s.key, { rate: e.target.value })
                    }
                  />
                  <span className="text-xs font-bold text-slate-600">%</span>
                  {slabs.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove slab ${i + 1}`}
                      onClick={() =>
                        setSlabs((ss) => ss.filter((x) => x.key !== s.key))
                      }
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                const last = slabs.at(-1);
                setSlabs((ss) => [
                  ...ss,
                  { key: slabKey++, from: last?.to ?? "", to: "", rate: "" },
                ]);
              }}
              className="flex items-center gap-1.5 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Next Slab
            </Button>
          </div>
        </fieldset>

        <ServerError message={error} />
        <DialogActions
          onCancel={onClose}
          submitting={save.isPending}
          submitLabel="Save Regime Slabs"
        />
      </form>
    </Dialog>
  );
}

function RegimeCard({
  financialYear,
  regime,
  rules,
  canWrite,
}: {
  financialYear: string;
  regime: TaxRegime;
  rules: TaxRegimeRules | null;
  canWrite: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const isNew = regime === "NEW";

  return (
    <Card className="flex flex-col justify-between">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#0a3271] dark:text-white">
                {regime} Tax Regime
              </h3>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  isNew
                    ? "bg-sky-100 text-brand-700 dark:bg-slate-800 dark:text-sky-300"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {isNew ? "Default (Sec 115BAC)" : "Optional with Deductions"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isNew
                ? "Lower slab rates, ₹75k standard deduction, zero deduction paperwork."
                : "Allows Chapter VI-A (80C, 80D), HRA, and home loan interest exemptions."}
            </p>
          </div>
          {canWrite ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 text-xs font-semibold"
            >
              <Edit3 className="h-3.5 w-3.5" />
              {rules ? "Edit Slabs" : "Set Up"}
            </Button>
          ) : null}
        </div>

        {rules ? (
          <>
            {/* 3 Statutory Chips */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-800/50">
                <p className="text-[10px] font-bold uppercase text-slate-400">
                  Std. Deduction
                </p>
                <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                  {money(rules.standardDeduction)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-800/50">
                <p className="text-[10px] font-bold uppercase text-slate-400">
                  87A Rebate Cap
                </p>
                <p className="text-xs font-bold text-brand-600 dark:text-sky-400 mt-0.5">
                  {money(rules.rebateIncomeLimit)}
                </p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-800/50">
                <p className="text-[10px] font-bold uppercase text-slate-400">
                  Cess Rate
                </p>
                <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                  {Number(rules.cessPercent)}%
                </p>
              </div>
            </div>

            {/* Slabs DataTable */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Statutory Tax Slabs (FY {financialYear})
              </p>
              <DataTable
                caption={`${regime} regime slabs ${financialYear}`}
                rows={rules.slabs}
                getRowKey={(r) => String(r.id)}
                columns={[
                  {
                    header: "Income From",
                    cell: (r) => (
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {money(r.fromIncome)}
                      </span>
                    ),
                  },
                  {
                    header: "Income Up To",
                    cell: (r) => (
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {r.toIncome === null
                          ? "Above (No Limit)"
                          : money(r.toIncome)}
                      </span>
                    ),
                  },
                  {
                    header: "Tax Rate",
                    cell: (r) => {
                      const rate = Number(r.ratePercent);
                      const badgeClass =
                        rate === 0
                          ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          : rate <= 5
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : rate <= 15
                              ? "bg-sky-50 text-brand-700 dark:bg-slate-800 dark:text-sky-300"
                              : rate <= 20
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300";
                      return (
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${badgeClass}`}
                        >
                          {rate}%
                        </span>
                      );
                    },
                    className: "text-right",
                    headerClassName: "text-right",
                  },
                ]}
              />
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/30">
            <Info className="mx-auto h-7 w-7 text-gray-400 mb-1.5" />
            <p className="text-xs font-bold text-gray-700 dark:text-gray-300">
              Not configured for FY {financialYear}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              With TDS deduction enabled, monthly payroll runs require active
              slabs for this financial year.
            </p>
          </div>
        )}
      </div>

      {editing ? (
        <RegimeDialog
          financialYear={financialYear}
          regime={regime}
          current={rules}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </Card>
  );
}

/** Income-tax rules per financial year and regime (§3.6, §4.11). */
export function TaxRegimesSection() {
  const canWrite = usePermission(PAYROLL_SETTINGS_WRITE);
  const years = recentFinancialYears(4);
  const [financialYear, setFinancialYear] = useState(years[0] ?? "");
  const [showSimulator, setShowSimulator] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const query = useTaxRegimes(financialYear);
  const byRegime = new Map((query.data ?? []).map((r) => [r.regime, r]));

  return (
    <div className="flex flex-col gap-5">
      {/* 1. 4 Interactive Statutory KPI Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Standard Deduction Card */}
        <div className="flex items-center justify-between rounded-2xl border border-sky-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
              Standard Deduction
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-[#0a3271] dark:text-white">
              ₹75,000
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              New: ₹75k · Old: ₹50k flat
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-500 dark:border-slate-700 dark:bg-slate-800">
            <Receipt className="h-5 w-5" />
          </div>
        </div>

        {/* Section 87A Full Rebate Limit */}
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200/90 bg-white p-4 shadow-2xs dark:border-emerald-900/60 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Sec 87A Rebate Ceiling
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              ₹7,00,000
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Nil tax up to ₹7.75L CTC (New)
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        {/* Health & Education Cess */}
        <div className="flex items-center justify-between rounded-2xl border border-sky-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
              Health & Education Cess
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-brand-600 dark:text-sky-300">
              4.00%
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Across all regimes on gross TDS
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-500 dark:border-slate-700 dark:bg-slate-800">
            <Percent className="h-5 w-5" />
          </div>
        </div>

        {/* Old Regime Exemptions Limit */}
        <div className="flex items-center justify-between rounded-2xl border border-amber-200/90 bg-white p-4 shadow-2xs dark:border-amber-900/60 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Old Regime Deductions
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              ₹3,50,000+
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              ₹1.5L (80C) + ₹2L (Sec 24b)
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950/40">
            <Coins className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 2. Top Controls & Action Toolbar Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-300/80 bg-linear-to-r from-sky-50/70 via-white to-sky-50/40 p-4 shadow-2xs dark:border-sky-800/60 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-48">
            <FormField label="Financial Year">
              {(f) => (
                <Select
                  {...f}
                  value={financialYear}
                  onChange={(e) => setFinancialYear(e.target.value)}
                  className="font-bold text-xs"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      FY {y} {y === years[0] ? "(Active)" : ""}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          </div>
          <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-bold text-brand-700 dark:bg-slate-800 dark:text-sky-300">
            Sec 115BAC Enforced
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowSimulator((s) => !s)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#0a3271] dark:text-sky-300"
          >
            <Calculator className="h-3.5 w-3.5 text-brand-600" />
            {showSimulator ? "Hide TDS Simulator" : "Interactive TDS Simulator"}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowGuide(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-brand-600"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Tax Slabs Guide
          </Button>
        </div>
      </div>

      {/* 3. Collapsible TDS Simulator */}
      {showSimulator && (
        <TaxTdsSimulator onClose={() => setShowSimulator(false)} />
      )}

      <QueryState query={query} area="tax regimes" />

      {/* 4. Side-by-Side Slabs Cards Grid */}
      {query.isSuccess ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {TAX_REGIMES.map((r) => (
            <RegimeCard
              key={`${financialYear}-${r}`}
              financialYear={financialYear}
              regime={r}
              rules={byRegime.get(r) ?? null}
              canWrite={canWrite}
            />
          ))}
        </div>
      ) : null}

      {/* Guide Dialog */}
      {showGuide && <TaxSlabsGuideDialog onClose={() => setShowGuide(false)} />}
    </div>
  );
}

// ============================================================================
// Professional Tax Section
// ============================================================================

function PtSlabDialog({ onClose }: { onClose: () => void }) {
  const create = useCreatePtSlab();
  const { toast } = useToast();
  const [stateCode, setStateCode] = useState("TN");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [amount, setAmount] = useState("");
  const [specialMonth, setSpecialMonth] = useState("");
  const [specialAmount, setSpecialAmount] = useState("");
  const [months, setMonths] = useState<number[]>([]);
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  const handleApplyPreset = (p: PtStatePreset) => {
    setStateCode(p.stateCode);
    const s0 = p.slabs[0];
    if (s0) {
      setMin(String(s0.minMonthlyWage));
      setMax(s0.maxMonthlyWage === null ? "" : String(s0.maxMonthlyWage));
      setAmount(String(s0.monthlyAmount));
      if (s0.specialMonth) setSpecialMonth(String(s0.specialMonth));
      if (s0.specialAmount) setSpecialAmount(String(s0.specialAmount));
      if (s0.applicableMonths) setMonths(s0.applicableMonths);
    }
    toast({
      title: `Selected ${p.stateName} (${p.stateCode}) statutory profile`,
      variant: "success",
    });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = stateCode.trim().toUpperCase();
    if (!/^[A-Z]{2,3}$/.test(code))
      return setError("State code: 2–3 letters, e.g. TN, KA, MH");
    if (min === "" || !(Number(min) >= 0))
      return setError("Enter the minimum monthly wage");
    if (max !== "" && Number(max) < Number(min))
      return setError("The maximum monthly wage is below the minimum");
    if (amount === "" || !(Number(amount) >= 0))
      return setError("Enter the monthly PT deduction amount");
    if ((specialMonth === "") !== (specialAmount === ""))
      return setError("Give the special month and its amount together");
    if (!from) return setError("Choose the effective-from date");
    setError(null);
    try {
      await create.mutateAsync({
        stateCode: code,
        minMonthlyWage: Number(min),
        maxMonthlyWage: max === "" ? null : Number(max),
        monthlyAmount: Number(amount),
        ...(specialMonth
          ? {
              specialMonth: Number(specialMonth),
              specialAmount: Number(specialAmount),
            }
          : {}),
        ...(months.length ? { applicableMonths: months } : {}),
        effectiveFrom: from,
      });
      toast({ title: `PT slab added for ${code}`, variant: "success" });
      onClose();
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="New Professional Tax Slab"
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        {/* Quick State Presets Bar */}
        <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/60">
          <p className="font-bold text-[#0a3271] dark:text-sky-300 mb-1.5">
            Quick State Statutory Presets
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PT_STATE_PRESETS.map((p) => (
              <button
                key={p.stateCode}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className={`rounded-lg border px-2 py-1 text-xs font-semibold transition ${
                  stateCode === p.stateCode
                    ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-sky-300"
                    : "border-gray-200 bg-white hover:bg-gray-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {p.stateName} ({p.stateCode})
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="State Jurisdiction" required>
            {(f) => (
              <Select
                {...f}
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                className="font-bold text-xs"
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </Select>
            )}
          </FormField>

          <FormField label="Effective From" required>
            {(f) => (
              <Input
                {...f}
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="font-semibold"
              />
            )}
          </FormField>

          <FormField label="Monthly Gross From (₹)" required>
            {(f) => (
              <Input
                {...f}
                type="number"
                min={0}
                placeholder="0"
                value={min}
                onChange={(e) => setMin(e.target.value)}
                className="font-semibold"
              />
            )}
          </FormField>

          <FormField
            label="Monthly Gross Up To (₹)"
            hint="Leave empty for upper bracket"
          >
            {(f) => (
              <Input
                {...f}
                type="number"
                min={0}
                placeholder="No limit"
                value={max}
                onChange={(e) => setMax(e.target.value)}
                className="font-semibold"
              />
            )}
          </FormField>

          <FormField label="Monthly PT Deduction (₹)" required>
            {(f) => (
              <Input
                {...f}
                type="number"
                min={0}
                placeholder="e.g. 200"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="font-semibold text-brand-600 dark:text-sky-400"
              />
            )}
          </FormField>

          <div className="grid grid-cols-2 gap-2">
            <FormField label="Special Month" hint="e.g. Feb extra in MH">
              {(f) => (
                <Select
                  {...f}
                  value={specialMonth}
                  onChange={(e) => setSpecialMonth(e.target.value)}
                  className="text-xs"
                >
                  <option value="">None</option>
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField label="Special Amount (₹)">
              {(f) => (
                <Input
                  {...f}
                  type="number"
                  min={0}
                  placeholder="e.g. 300"
                  value={specialAmount}
                  onChange={(e) => setSpecialAmount(e.target.value)}
                  className="font-semibold text-xs"
                />
              )}
            </FormField>
          </div>
        </div>

        {/* Applicable Months Selector */}
        <fieldset className="rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center justify-between mb-2">
            <legend className="text-xs font-bold text-slate-900 dark:text-white">
              Applicable Deduction Months
            </legend>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMonths([])}
                className="text-[10px] font-bold text-brand-600 hover:underline"
              >
                Every Month
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => setMonths([9, 2])}
                className="text-[10px] font-bold text-brand-600 hover:underline"
              >
                Half-Yearly (Sep & Feb)
              </button>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mb-2">
            Leave all unticked for monthly deduction. Tick specific months for
            states like Tamil Nadu (Sep, Feb).
          </p>
          <div className="flex flex-wrap gap-2">
            {MONTH_OPTIONS.map((m) => {
              const checked = months.includes(m.value);
              return (
                <label
                  key={m.value}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold cursor-pointer transition ${
                    checked
                      ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-sky-300"
                      : "border-gray-200 bg-white text-slate-600 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setMonths((ms) =>
                        e.target.checked
                          ? [...ms, m.value]
                          : ms.filter((x) => x !== m.value),
                      )
                    }
                    className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span>{m.label.slice(0, 3)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <ServerError message={error} />
        <DialogActions
          onCancel={onClose}
          submitting={create.isPending}
          submitLabel="Create PT Slab"
        />
      </form>
    </Dialog>
  );
}

function LocationStates({ canWrite }: { canWrite: boolean }) {
  const locations = useWorkLocations(true);
  const states = usePtLocationStates();
  const setState = useSetPtLocationState();
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  const mapped = new Map(
    (states.data ?? []).map((s) => [s.workLocationId, s.stateCode]),
  );
  const rows = locations.data ?? [];

  async function save(workLocationId: number) {
    const code = (drafts[workLocationId] ?? mapped.get(workLocationId) ?? "TN")
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{2,3}$/.test(code))
      return setError("State code: 2–3 letters, e.g. TN, KA, MH");
    setError(null);
    try {
      await setState.mutateAsync({ workLocationId, stateCode: code });
      toast({
        title: `Mapped ${code} PT jurisdiction to location`,
        variant: "success",
      });
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <Card>
      <section
        aria-labelledby="pt-locations-heading"
        className="flex flex-col gap-4"
      >
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-brand-600 dark:text-sky-400" />
              <h3
                id="pt-locations-heading"
                className="text-base font-bold text-[#0a3271] dark:text-white"
              >
                Work Location PT State Jurisdiction Mapping
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Employees assigned to a work location automatically inherit its
              state PT slabs. Unassigned locations fall back to the default PT
              state (Policy tab).
            </p>
          </div>
          <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-bold text-brand-700 dark:bg-slate-800 dark:text-sky-300">
            {rows.length} Branch Offices
          </span>
        </div>

        <QueryState query={locations} area="work locations" />

        {locations.isSuccess && rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/30">
            <Building2 className="mx-auto h-7 w-7 text-gray-400 mb-1.5" />
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              No work locations configured
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              Create work locations under HR settings to map specific state PT
              slabs.
            </p>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <DataTable
            caption="Work location PT states"
            rows={rows}
            getRowKey={(r) => String(r.id)}
            columns={[
              {
                header: "Work Location",
                cell: (r) => (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {r.name}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      ID #{r.id}
                    </span>
                  </div>
                ),
              },
              {
                header: "Assigned State",
                cell: (r) => {
                  const currentCode = mapped.get(r.id);
                  if (!currentCode) {
                    return (
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        Default Policy State
                      </span>
                    );
                  }
                  const name = STATE_NAME_BY_CODE.get(currentCode);
                  return (
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-50 px-2.5 py-0.5 text-xs font-bold text-brand-700 dark:bg-slate-800 dark:text-sky-300">
                      <span>{currentCode}</span>
                      <span className="text-[11px] font-normal text-slate-500">
                        ({name ?? "State"})
                      </span>
                    </span>
                  );
                },
              },
              {
                header: "Change Jurisdiction",
                cell: (r) =>
                  canWrite ? (
                    <div className="flex items-center gap-2">
                      <Select
                        aria-label={`PT state of ${r.name}`}
                        className="w-44 font-semibold text-xs"
                        value={drafts[r.id] ?? mapped.get(r.id) ?? ""}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [r.id]: e.target.value }))
                        }
                      >
                        <option value="">Policy Default</option>
                        {INDIAN_STATES.map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.code} – {s.name}
                          </option>
                        ))}
                      </Select>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void save(r.id)}
                        disabled={setState.isPending}
                        className="text-xs font-semibold"
                      >
                        Save
                      </Button>
                    </div>
                  ) : null,
              },
            ]}
          />
        ) : null}

        <ServerError message={error} />
      </section>
    </Card>
  );
}

/** Professional Tax slabs per state and the state of each location (§3.5). */
export function ProfessionalTaxSection() {
  const canWrite = usePermission(PAYROLL_SETTINGS_WRITE);
  const query = usePtSlabs();
  const update = useUpdatePtSlab();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<
    "ACTIVE" | "ALL" | "INACTIVE"
  >("ACTIVE");

  const rows = query.data ?? [];

  // Top KPI Metrics
  const activeSlabs = rows.filter((r) => r.isActive).length;
  const distinctStates = new Set(rows.map((r) => r.stateCode)).size;

  // Filtered rows
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter === "ACTIVE" && !r.isActive) return false;
      if (statusFilter === "INACTIVE" && r.isActive) return false;

      if (stateFilter !== "ALL" && r.stateCode !== stateFilter) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesCode = r.stateCode.toLowerCase().includes(q);
        const matchesStateName = (STATE_NAME_BY_CODE.get(r.stateCode) ?? "")
          .toLowerCase()
          .includes(q);
        const matchesAmount = String(r.monthlyAmount).includes(q);
        if (!matchesCode && !matchesStateName && !matchesAmount) return false;
      }

      return true;
    });
  }, [rows, statusFilter, stateFilter, search]);

  const hasActiveFilters =
    search.trim() !== "" || stateFilter !== "ALL" || statusFilter !== "ACTIVE";

  const handleResetFilters = () => {
    setSearch("");
    setStateFilter("ALL");
    setStatusFilter("ACTIVE");
  };

  async function deactivate(slab: PtSlab) {
    setError(null);
    try {
      await update.mutateAsync({ id: slab.id, body: { isActive: false } });
      toast({ title: "PT slab deactivated", variant: "success" });
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 1. 4 Interactive Statutory KPI Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Active Slabs Card */}
        <div className="flex items-center justify-between rounded-2xl border border-sky-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
              Active PT Slabs
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-[#0a3271] dark:text-white">
              {activeSlabs}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Across {rows.length} total rules
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-500 dark:border-slate-700 dark:bg-slate-800">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        {/* Covered States */}
        <div className="flex items-center justify-between rounded-2xl border border-sky-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
              Covered States
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-brand-600 dark:text-sky-300">
              {distinctStates} States
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Jurisdictions configured
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-500 dark:border-slate-700 dark:bg-slate-800">
            <Building2 className="h-5 w-5" />
          </div>
        </div>

        {/* Constitutional Ceiling */}
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200/90 bg-white p-4 shadow-2xs dark:border-emerald-900/60 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Constitutional Ceiling
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              ₹2,500 / yr
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Article 276(2) Constitution of India
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        {/* Statutory Cycle */}
        <div className="flex items-center justify-between rounded-2xl border border-amber-200/90 bg-white p-4 shadow-2xs dark:border-amber-900/60 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Deduction Cycles
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              Monthly / Bi-annual
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Monthly (KA/MH) · Sep & Feb (TN)
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950/40">
            <Calendar className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 2. Unified Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-70">
          {/* Live Search */}
          <div className="relative flex-1 min-w-50">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by state code, state name, or amount..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 py-2.5 pl-10 pr-4 text-xs text-gray-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 dark:border-slate-800 dark:bg-slate-800/50 dark:text-white dark:focus:border-brand-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* State Filter */}
          <div className="w-full sm:w-44">
            <Select
              aria-label="Filter by state"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
            >
              <option value="ALL">All States</option>
              {Array.from(new Set(rows.map((r) => r.stateCode))).map((code) => (
                <option key={code} value={code}>
                  {code} ({STATE_NAME_BY_CODE.get(code) ?? "State"})
                </option>
              ))}
            </Select>
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-36">
            <Select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "ACTIVE" | "ALL" | "INACTIVE")
              }
            >
              <option value="ACTIVE">Active only</option>
              <option value="ALL">All statuses</option>
              <option value="INACTIVE">Inactive only</option>
            </Select>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {canWrite ? (
            <Button
              size="sm"
              onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 bg-[#1769F5] hover:bg-[#1258d4] text-white font-semibold text-xs px-3.5 py-2 rounded-xl shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              New PT Slab
            </Button>
          ) : null}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowGuide(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-brand-600"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            PT Rules Guide
          </Button>
        </div>
      </div>

      <QueryState query={query} area="PT slabs" />

      {/* 3. DataTable */}
      {query.isSuccess && filteredRows.length === 0 ? (
        <Card>
          <EmptyState
            title="No PT slabs match filters"
            description={
              hasActiveFilters
                ? "No Professional Tax slabs match your search criteria."
                : "Add the slabs for each state where your organisation operates and employs staff."
            }
          />
        </Card>
      ) : null}

      {filteredRows.length > 0 ? (
        <DataTable<PtSlab>
          caption="Professional Tax slabs"
          rows={filteredRows}
          getRowKey={(r) => String(r.id)}
          columns={[
            {
              header: "State Jurisdiction",
              cell: (r) => {
                const name = STATE_NAME_BY_CODE.get(r.stateCode);
                return (
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-xs font-bold text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-sky-300">
                      {r.stateCode}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {name ?? r.stateCode}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        State Code: {r.stateCode}
                      </span>
                    </div>
                  </div>
                );
              },
            },
            {
              header: "Monthly Gross Wage Range",
              cell: (r) => (
                <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                  <span>{money(r.minMonthlyWage)}</span>
                  <span className="text-slate-400">→</span>
                  <span>
                    {r.maxMonthlyWage === null
                      ? "Above (No limit)"
                      : money(r.maxMonthlyWage)}
                  </span>
                </div>
              ),
            },
            {
              header: "PT Deduction",
              cell: (r) => (
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-bold text-brand-600 dark:text-sky-400">
                    {money(r.monthlyAmount)} / mo
                  </span>
                  {r.specialMonth ? (
                    <span className="rounded bg-amber-50 px-1.5 py-0.2 text-[10px] font-bold text-amber-700 dark:bg-slate-800 dark:text-amber-300">
                      {MONTH_OPTIONS[r.specialMonth - 1]?.label.slice(0, 3)}:{" "}
                      {money(r.specialAmount)}
                    </span>
                  ) : null}
                </div>
              ),
              className: "text-right whitespace-nowrap",
              headerClassName: "text-right",
            },
            {
              header: "Deduction Cycle",
              cell: (r) =>
                r.applicableMonths.length === 0 ? (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    Every Month
                  </span>
                ) : (
                  <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-slate-800 dark:text-amber-300">
                    {r.applicableMonths
                      .map((m) => MONTH_OPTIONS[m - 1]?.label.slice(0, 3))
                      .join(", ")}
                  </span>
                ),
            },
            {
              header: "Effective Period",
              cell: (r) => (
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {isoDate(r.effectiveFrom)} →{" "}
                  {r.effectiveTo ? isoDate(r.effectiveTo) : "Active"}
                </span>
              ),
            },
            {
              header: "Status",
              cell: (r) => (
                <StatusPill status={r.isActive ? "ACTIVE" : "INACTIVE"} />
              ),
            },
            {
              header: "Actions",
              cell: (r) =>
                canWrite && r.isActive ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={update.isPending}
                    onClick={() => void deactivate(r)}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                  >
                    Deactivate
                  </Button>
                ) : null,
              className: "text-right",
              headerClassName: "text-right",
            },
          ]}
        />
      ) : null}

      <ServerError message={error} />

      {/* 4. Location Mapping Section */}
      <LocationStates canWrite={canWrite} />

      {/* Modals */}
      {creating && <PtSlabDialog onClose={() => setCreating(false)} />}
      {showGuide && (
        <PtStatutoryGuideModal onClose={() => setShowGuide(false)} />
      )}
    </div>
  );
}
