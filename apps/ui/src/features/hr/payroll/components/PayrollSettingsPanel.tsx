"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  FileText,
  HelpCircle,
  Info,
  Percent,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  FormField,
  Input,
  Select,
  type TabItem,
  Tabs,
  Textarea,
  useToast,
} from "@texawave-erp/ui-kit";
import { usePermission } from "@/hooks/usePermission";
import type { PayrollSettingsBody } from "../api";
import { PAY_DAYS_LABEL, describeError, money, timestamp } from "../format";
import { usePayrollSettings, useUpdatePayrollSettings } from "../hooks";
import { PAYROLL_SETTINGS_READ, PAYROLL_SETTINGS_WRITE } from "../permissions";
import { PAY_DAYS_MODES, type PayrollSettings, TAX_REGIMES } from "../types";
import { ServerError } from "./DialogParts";
import { QueryState } from "./QueryState";
import { ComponentsSection, TemplatesSection } from "./SalaryMastersSections";
import { NoAccess } from "./SectionHeader";
import { ProfessionalTaxSection, TaxRegimesSection } from "./TaxSetupSections";

type Key = keyof Omit<PayrollSettings, "isDefault" | "version" | "updatedAt">;

type FieldAdornment =
  "currency" | "percent" | "multiplier" | "hours" | "years" | "none";

type Field =
  | {
      key: Key;
      label: string;
      kind: "number";
      hint?: string;
      step?: string;
      adornment?: FieldAdornment;
    }
  | { key: Key; label: string; kind: "flag"; hint?: string }
  | { key: Key; label: string; kind: "text"; hint?: string; long?: boolean }
  | {
      key: Key;
      label: string;
      kind: "choice";
      hint?: string;
      options: ReadonlyArray<readonly [string, string]>;
    };

interface SettingsCategory {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof Calendar;
  groups: ReadonlyArray<{
    title: string;
    description?: string;
    fields: readonly Field[];
  }>;
}

const CATEGORIES: readonly SettingsCategory[] = [
  {
    id: "attendance",
    title: "Attendance & Overtime",
    subtitle:
      "Loss-of-pay divisors, attendance sync, and overtime hourly rates",
    icon: Calendar,
    groups: [
      {
        title: "Pay days divisor & attendance",
        description:
          "Controls how daily wage rates are calculated for loss of pay (LOP) and proration.",
        fields: [
          {
            key: "payDaysMode",
            label: "Per-day divisor",
            kind: "choice",
            options: PAY_DAYS_MODES.map((m) => [m, PAY_DAYS_LABEL[m]] as const),
            hint: "Each loss-of-pay day costs gross ÷ this many days.",
          },
          {
            key: "useAttendance",
            label: "Read approved attendance month",
            kind: "flag",
            hint: "Absences, half days and overtime pull automatically from monthly attendance close.",
          },
          {
            key: "unmarkedDaysAsAbsent",
            label: "Count a working day with no attendance as absent",
            kind: "flag",
            hint: "Treats unpunched days without approved leaves as loss of pay.",
          },
        ],
      },
      {
        title: "Overtime compensation",
        description:
          "Configure hourly pay calculation rules for approved overtime minutes.",
        fields: [
          {
            key: "overtimeEnabled",
            label: "Enable overtime compensation",
            kind: "flag",
          },
          {
            key: "overtimeRatePerHour",
            label: "Fixed hourly rate (₹)",
            kind: "number",
            adornment: "currency",
            hint: "Optional. Leave blank to compute automatically from hourly wage × multiplier.",
          },
          {
            key: "overtimeMultiplier",
            label: "Overtime multiplier",
            kind: "number",
            step: "0.01",
            adornment: "multiplier",
            hint: "e.g. 2.00 for double pay on standard hourly rate.",
          },
          {
            key: "standardHoursPerDay",
            label: "Standard working hours per day",
            kind: "number",
            step: "0.25",
            adornment: "hours",
            hint: "Used as the divisor to compute base hourly wage from daily rate.",
          },
        ],
      },
    ],
  },
  {
    id: "pf",
    title: "Provident Fund (EPFO)",
    subtitle:
      "Statutory PF, EPS pension, EDLI life insurance, and wage ceilings",
    icon: ShieldCheck,
    groups: [
      {
        title: "EPFO statutory parameters",
        description:
          "Employee and employer contribution ratios under the Employees' Provident Funds Act, 1952.",
        fields: [
          {
            key: "pfWageCeiling",
            label: "PF wage ceiling (₹)",
            kind: "number",
            adornment: "currency",
            hint: "Standard statutory cap is ₹15,000 / month.",
          },
          {
            key: "pfCapAtCeiling",
            label: "Cap PF calculations at statutory ceiling",
            kind: "flag",
            hint: "When disabled, PF is computed on full Basic + DA without cap (voluntary).",
          },
          {
            key: "pfEmployeeRate",
            label: "Employee contribution rate",
            kind: "number",
            step: "0.01",
            adornment: "percent",
            hint: "Standard statutory rate is 12.00%.",
          },
          {
            key: "pfEmployerRate",
            label: "Employer contribution rate",
            kind: "number",
            step: "0.01",
            adornment: "percent",
            hint: "Standard statutory rate is 12.00%.",
          },
          {
            key: "epsRate",
            label: "EPS pension share",
            kind: "number",
            step: "0.01",
            adornment: "percent",
            hint: "Portion of employer contribution allocated to Pension Fund (standard 8.33%).",
          },
          {
            key: "epsWageCeiling",
            label: "EPS wage ceiling (₹)",
            kind: "number",
            adornment: "currency",
            hint: "Statutory cap for pension computation (standard ₹15,000).",
          },
          {
            key: "epsAgeLimit",
            label: "No EPS allocation from age",
            kind: "number",
            adornment: "years",
            hint: "Employees above this age (standard 58) contribute 100% of employer share to EPF.",
          },
          {
            key: "edliRate",
            label: "EDLI insurance rate",
            kind: "number",
            step: "0.01",
            adornment: "percent",
            hint: "Employees' Deposit Linked Insurance scheme rate (standard 0.50%).",
          },
          {
            key: "edliWageCeiling",
            label: "EDLI wage ceiling (₹)",
            kind: "number",
            adornment: "currency",
            hint: "Statutory ceiling for insurance computation (standard ₹15,000).",
          },
          {
            key: "pfAdminRate",
            label: "EPFO admin charges",
            kind: "number",
            step: "0.01",
            adornment: "percent",
            hint: "Administrative charges levied by EPFO (standard 0.50%).",
          },
        ],
      },
    ],
  },
  {
    id: "esi",
    title: "ESI Contributions (ESIC)",
    subtitle:
      "Health insurance wage threshold and employee/employer contributions",
    icon: Users,
    groups: [
      {
        title: "Employees' State Insurance parameters",
        description:
          "Statutory health scheme parameters under the ESI Act, 1948.",
        fields: [
          {
            key: "esiWageThreshold",
            label: "Gross wage eligibility limit",
            kind: "number",
            adornment: "currency",
            hint: "Employees earning up to this gross amount (standard ₹21,000/month) are covered.",
          },
          {
            key: "esiEmployeeRate",
            label: "Employee contribution rate",
            kind: "number",
            step: "0.01",
            adornment: "percent",
            hint: "Standard employee contribution is 0.75% of gross wage.",
          },
          {
            key: "esiEmployerRate",
            label: "Employer contribution rate",
            kind: "number",
            step: "0.01",
            adornment: "percent",
            hint: "Standard employer contribution is 3.25% of gross wage.",
          },
        ],
      },
    ],
  },
  {
    id: "taxes",
    title: "Taxes, TDS & Loans",
    subtitle:
      "Professional Tax, default income tax regime, and employee loan limits",
    icon: Coins,
    groups: [
      {
        title: "Professional Tax (PT) & TDS",
        description:
          "State-wise professional tax and tax deduction at source rules.",
        fields: [
          {
            key: "ptEnabled",
            label: "Deduct Professional Tax automatically",
            kind: "flag",
          },
          {
            key: "ptDefaultStateCode",
            label: "Default PT state code",
            kind: "text",
            hint: "e.g. TN, KA, MH — used for employees whose work locations do not specify a state.",
          },
          {
            key: "tdsEnabled",
            label: "Deduct TDS (Income Tax) automatically",
            kind: "flag",
            hint: "Computes monthly TDS based on annual tax declarations and tax slab setup.",
          },
          {
            key: "defaultTaxRegime",
            label: "Default tax regime (without declaration)",
            kind: "choice",
            options: TAX_REGIMES.map(
              (r) => [r, `${r} regime (Sec 115BAC)`] as const,
            ),
            hint: "Applied to employees who have not submitted an investment declaration.",
          },
        ],
      },
      {
        title: "Employee loan recovery limits",
        description: "Safeguards against excessive employee indebtedness.",
        fields: [
          {
            key: "loanMaxMultiple",
            label: "Maximum loan principal limit",
            kind: "number",
            step: "0.01",
            adornment: "multiplier",
            hint: "Multiple of monthly gross salary (e.g. 3.00 × gross). Requires admin override if exceeded.",
          },
          {
            key: "loanMaxEmiPercent",
            label: "Maximum total EMI cap",
            kind: "number",
            step: "0.01",
            adornment: "percent",
            hint: "Maximum percentage of monthly gross salary that can be deducted for loan EMIs.",
          },
        ],
      },
    ],
  },
  {
    id: "salary",
    title: "Salary Auto-Split & Gratuity",
    subtitle:
      "Gross CTC auto-split ratios, statutory bonus, and gratuity ceiling",
    icon: Percent,
    groups: [
      {
        title: "Salary structure auto-split (gross only)",
        description:
          "Automatic percentage breakdown applied when creating salaries from gross CTC.",
        fields: [
          {
            key: "basicPercent",
            label: "Basic salary share",
            kind: "number",
            step: "0.01",
            adornment: "percent",
            hint: "Standard recommended percentage is 35% to 50% of gross.",
          },
          {
            key: "hraPercent",
            label: "House Rent Allowance (HRA) share",
            kind: "number",
            step: "0.01",
            adornment: "percent",
            hint: "Standard percentage is 30% to 40% of Basic/Gross.",
          },
          {
            key: "conveyancePercent",
            label: "Conveyance allowance share",
            kind: "number",
            step: "0.01",
            adornment: "percent",
            hint: "Standard fixed conveyance allowance percentage.",
          },
        ],
      },
      {
        title: "Statutory bonus & gratuity caps",
        description:
          "Payment of Bonus Act, 1965 and Payment of Gratuity Act, 1972 parameters.",
        fields: [
          {
            key: "bonusEligibilityLimit",
            label: "Bonus eligibility limit (₹)",
            kind: "number",
            adornment: "currency",
            hint: "Statutory wage threshold for bonus eligibility (standard ₹21,000/month).",
          },
          {
            key: "bonusCalculationCeiling",
            label: "Bonus calculation ceiling (₹)",
            kind: "number",
            adornment: "currency",
            hint: "Statutory ceiling used to compute minimum bonus (standard ₹7,000).",
          },
          {
            key: "bonusPercent",
            label: "Minimum bonus percentage",
            kind: "number",
            step: "0.01",
            adornment: "percent",
            hint: "Statutory minimum bonus rate is 8.33%.",
          },
          {
            key: "gratuityMinYears",
            label: "Gratuity eligibility threshold",
            kind: "number",
            adornment: "years",
            hint: "Standard statutory service requirement is 5 continuous years.",
          },
          {
            key: "gratuityCap",
            label: "Maximum statutory gratuity cap",
            kind: "number",
            adornment: "currency",
            hint: "Maximum tax-exempt statutory gratuity cap (standard ₹20,00,000).",
          },
        ],
      },
    ],
  },
  {
    id: "company",
    title: "Company Statutory Profile",
    subtitle:
      "Legal identifiers required for payslips, Form 16, and EPFO/ESIC filings",
    icon: Building2,
    groups: [
      {
        title: "Company identity & tax registrations",
        description:
          "These details are automatically printed on official salary slips and Form 16 Part B certificates.",
        fields: [
          {
            key: "companyName",
            label: "Registered company name",
            kind: "text",
          },
          {
            key: "companyAddress",
            label: "Registered office address",
            kind: "text",
            long: true,
            hint: "Complete official address including PIN code.",
          },
          {
            key: "companyGstin",
            label: "GSTIN number",
            kind: "text",
            hint: "15-digit Goods and Services Tax Identification Number.",
          },
          {
            key: "companyPan",
            label: "Company PAN number",
            kind: "text",
            hint: "10-character Permanent Account Number.",
          },
          {
            key: "companyTan",
            label: "Company TAN number",
            kind: "text",
            hint: "10-character Tax Deduction and Collection Account Number (required for Form 16).",
          },
          {
            key: "pfEstablishmentCode",
            label: "PF establishment code",
            kind: "text",
            hint: "EPFO establishment code (e.g. TN/MAS/12345/000).",
          },
          {
            key: "esiEmployerCode",
            label: "ESI employer registration code",
            kind: "text",
            hint: "17-digit ESIC employer registration number.",
          },
        ],
      },
    ],
  },
];

type Draft = Record<Key, string | boolean>;

function toDraft(s: PayrollSettings): Draft {
  const out = {} as Draft;
  for (const c of CATEGORIES) {
    for (const g of c.groups) {
      for (const f of g.fields) {
        const v = s[f.key];
        out[f.key] = typeof v === "boolean" ? v : v === null ? "" : String(v);
      }
    }
  }
  return out;
}

function changes(
  draft: Draft,
  saved: PayrollSettings,
): { body: PayrollSettingsBody } | { error: string } {
  const body: Record<string, unknown> = { version: saved.version };
  for (const c of CATEGORIES) {
    for (const g of c.groups) {
      for (const f of g.fields) {
        const value = draft[f.key];
        const before = saved[f.key];
        if (f.kind === "flag") {
          if (value !== before) body[f.key] = value;
          continue;
        }
        const text = String(value ?? "").trim();
        if (f.kind === "number") {
          if (text === "") {
            if (f.key === "overtimeRatePerHour") {
              if (before !== null) body[f.key] = null;
              continue;
            }
            return { error: `${f.label}: enter a valid number` };
          }
          const n = Number(text);
          if (!Number.isFinite(n))
            return { error: `${f.label}: enter a valid number` };
          if (n !== before) body[f.key] = n;
          continue;
        }
        const next =
          text === ""
            ? null
            : f.key === "ptDefaultStateCode"
              ? text.toUpperCase()
              : text;
        if (next !== before) body[f.key] = next;
      }
    }
  }
  return { body: body as PayrollSettingsBody };
}

// ============================================================================
// Live Salary Simulator Component
// ============================================================================

function SalarySimulator({
  basicPct,
  hraPct,
  conveyancePct,
}: {
  basicPct: number;
  hraPct: number;
  conveyancePct: number;
}) {
  const [testGross, setTestGross] = useState("50000");
  const gross = Math.max(0, Number(testGross) || 0);

  const basic = Math.round((gross * (basicPct || 0)) / 100);
  const hra = Math.round((gross * (hraPct || 0)) / 100);
  const conveyance = Math.round((gross * (conveyancePct || 0)) / 100);
  const remainder = Math.max(0, gross - basic - hra - conveyance);
  const pf = Math.round(Math.min(15000, basic) * 0.12);
  const estNet = Math.max(0, gross - pf);

  return (
    <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
            Interactive Salary Split Simulator
          </p>
          <p className="text-[11px] text-slate-500">
            Test how your Basic ({basicPct}%), HRA ({hraPct}%), and Conveyance (
            {conveyancePct}%) rules split a monthly salary.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Test Gross:
          </span>
          <div className="relative w-32">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
              ₹
            </span>
            <input
              type="number"
              min={0}
              value={testGross}
              onChange={(e) => setTestGross(e.target.value)}
              className="w-full rounded-lg border border-sky-200 bg-white py-1.5 pl-6 pr-2 text-xs font-bold text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 text-xs">
        <div className="rounded-xl border border-sky-100 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-800/80">
          <span className="text-[10px] font-bold text-slate-400 uppercase">
            Basic
          </span>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {money(basic)}
          </p>
          <span className="text-[10px] text-slate-400">{basicPct}%</span>
        </div>
        <div className="rounded-xl border border-sky-100 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-800/80">
          <span className="text-[10px] font-bold text-slate-400 uppercase">
            HRA
          </span>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {money(hra)}
          </p>
          <span className="text-[10px] text-slate-400">{hraPct}%</span>
        </div>
        <div className="rounded-xl border border-sky-100 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-800/80">
          <span className="text-[10px] font-bold text-slate-400 uppercase">
            Conveyance
          </span>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {money(conveyance)}
          </p>
          <span className="text-[10px] text-slate-400">{conveyancePct}%</span>
        </div>
        <div className="rounded-xl border border-sky-100 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-800/80">
          <span className="text-[10px] font-bold text-slate-400 uppercase">
            Special Allw
          </span>
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {money(remainder)}
          </p>
          <span className="text-[10px] text-slate-400">Remainder</span>
        </div>
        <div className="rounded-xl border border-amber-100 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-800/80">
          <span className="text-[10px] font-bold text-amber-600 uppercase">
            PF Deducted
          </span>
          <p className="text-sm font-bold text-amber-600">{money(pf)}</p>
          <span className="text-[10px] text-slate-400">12% on Basic</span>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-800/80">
          <span className="text-[10px] font-bold text-emerald-600 uppercase">
            Est. Take-Home
          </span>
          <p className="text-sm font-bold text-emerald-600">{money(estNet)}</p>
          <span className="text-[10px] text-slate-400">Before TDS</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Statutory Profile Completeness Scorecard
// ============================================================================

function ProfileScorecard({ draft }: { draft: Draft }) {
  const fields = [
    { label: "Company Name", val: draft.companyName },
    { label: "Registered Address", val: draft.companyAddress },
    { label: "GSTIN", val: draft.companyGstin },
    { label: "PAN", val: draft.companyPan },
    { label: "TAN (Required for Form 16)", val: draft.companyTan },
    { label: "PF Code", val: draft.pfEstablishmentCode },
    { label: "ESI Code", val: draft.esiEmployerCode },
  ];

  const filledCount = fields.filter((f) =>
    Boolean(String(f.val || "").trim()),
  ).length;
  const isComplete = filledCount === fields.length;

  return (
    <div
      className={`rounded-xl border p-4 text-xs ${
        isComplete
          ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-slate-900"
          : "border-sky-200 bg-sky-50/60 dark:border-slate-800 dark:bg-slate-900"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
          <ShieldCheck
            className={`h-4 w-4 ${isComplete ? "text-emerald-600" : "text-brand-500"}`}
          />
          <span>
            Statutory Legal Readiness ({filledCount} of {fields.length}{" "}
            Configured)
          </span>
        </div>
        <span
          className={`font-semibold ${
            isComplete
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-brand-600 dark:text-sky-300"
          }`}
        >
          {isComplete
            ? "100% Ready for Form 16 & Payslips"
            : "Important Identifiers Missing"}
        </span>
      </div>
      {!isComplete && (
        <p className="mt-1 text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
          Ensure company TAN and address are filled to generate Form 16 Part B
          certificates and official employee payslips without errors.
        </p>
      )}
    </div>
  );
}

// ============================================================================
// Main Policy Form Component with Category Sidebar
// ============================================================================

function PolicyForm({ settings }: { settings: PayrollSettings }) {
  const canWrite = usePermission(PAYROLL_SETTINGS_WRITE);
  const update = useUpdatePayrollSettings();
  const { toast } = useToast();

  const [activeCategory, setActiveCategory] = useState<string>("attendance");
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings));
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const set = (key: Key, value: string | boolean) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // Check if draft has unsaved changes
  const hasChanges = useMemo(() => {
    const res = changes(draft, settings);
    if ("error" in res) return false;
    return Object.keys(res.body).length > 1; // version is always present
  }, [draft, settings]);

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const res = changes(draft, settings);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    if (Object.keys(res.body).length === 1) {
      setError("Nothing changed.");
      return;
    }
    setError(null);
    try {
      const saved = await update.mutateAsync(res.body);
      setDraft(toDraft(saved));
      toast({
        title: "Payroll policy settings saved successfully",
        variant: "success",
      });
    } catch (err) {
      setError(describeError(err));
    }
  }

  // Quick preset: Apply Indian labor law standards
  function handleApplyGovtDefaults() {
    setDraft((prev) => ({
      ...prev,
      pfWageCeiling: "15000",
      pfCapAtCeiling: true,
      pfEmployeeRate: "12",
      pfEmployerRate: "12",
      epsRate: "8.33",
      epsWageCeiling: "15000",
      epsAgeLimit: "58",
      edliRate: "0.5",
      edliWageCeiling: "15000",
      pfAdminRate: "0.5",
      esiWageThreshold: "21000",
      esiEmployeeRate: "0.75",
      esiEmployerRate: "3.25",
      gratuityCap: "2000000",
      gratuityMinYears: "5",
      bonusEligibilityLimit: "21000",
      bonusCalculationCeiling: "7000",
      bonusPercent: "8.33",
    }));
    toast({
      title: "Statutory parameters loaded",
      description: "Standard EPFO, ESIC, and Gratuity values applied to form.",
      variant: "info",
    });
  }

  // Active category object
  const currentCategory = useMemo(() => {
    return (CATEGORIES.find((c) => c.id === activeCategory) ??
      CATEGORIES[0]) as SettingsCategory;
  }, [activeCategory]);

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {/* 1. Header Banner & Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sky-100 bg-linear-to-r from-sky-50/80 via-white to-blue-50/60 p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-white shadow-xs">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-[#0a3271] dark:text-white">
                Policy & Statutory Configuration
              </h2>
              <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-700 dark:bg-slate-800 dark:text-sky-300">
                Policy v{settings.version}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {settings.isDefault
                ? "Currently using built-in statutory defaults."
                : `Last saved ${timestamp(settings.updatedAt)}. Finalized payroll runs are legally locked.`}
            </p>
          </div>
        </div>

        {/* Action Presets */}
        {canWrite && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleApplyGovtDefaults}
              className="border-sky-200 text-xs font-semibold text-slate-700 hover:border-brand-400 dark:text-slate-200"
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-brand-500" />
              Apply Govt. Standards
            </Button>
          </div>
        )}
      </div>

      <ServerError message={error} />

      {/* 2. Two-Column Category Navigation & Active Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Category Navigation Menu */}
        <div className="lg:col-span-4 flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1 mb-1">
            Policy Modules
          </p>
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = cat.id === activeCategory;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`group flex items-start gap-3 rounded-2xl p-3.5 text-left transition-all ${
                  isActive
                    ? "border-2 border-brand-500 bg-sky-50/70 shadow-xs ring-2 ring-brand-500/15 dark:border-brand-400 dark:bg-slate-800"
                    : "border border-gray-200/80 bg-white hover:border-brand-300 hover:bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900"
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                    isActive
                      ? "border-brand-300 bg-brand-500 text-white"
                      : "border-sky-100 bg-sky-50 text-brand-600 dark:border-slate-700 dark:bg-slate-800 dark:text-sky-300"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        isActive
                          ? "text-[#0a3271] dark:text-white"
                          : "text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      {cat.title}
                    </span>
                    <ChevronRight
                      className={`h-3.5 w-3.5 transition-transform ${
                        isActive
                          ? "text-brand-500 translate-x-0.5"
                          : "text-slate-300 opacity-0 group-hover:opacity-100"
                      }`}
                    />
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                    {cat.subtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Column: Active Category Form Fields */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Header of Active Category */}
          <div className="border-b border-gray-100 pb-3 dark:border-slate-800">
            <h3 className="text-base font-bold text-[#0a3271] dark:text-white">
              {currentCategory.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {currentCategory.subtitle}
            </p>
          </div>

          {/* Special Category Previews */}
          {currentCategory.id === "salary" && (
            <SalarySimulator
              basicPct={Number(draft.basicPercent || 35)}
              hraPct={Number(draft.hraPercent || 30)}
              conveyancePct={Number(draft.conveyancePercent || 20)}
            />
          )}

          {currentCategory.id === "company" && (
            <ProfileScorecard draft={draft} />
          )}

          {/* Form Groups */}
          {currentCategory.groups.map((g) => (
            <div
              key={g.title}
              className="rounded-2xl border border-sky-100 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900"
            >
              <fieldset disabled={!canWrite} className="flex flex-col gap-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
                    {g.title}
                  </h4>
                  {g.description && (
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {g.description}
                    </p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {g.fields.map((f) => {
                    if (f.kind === "flag") {
                      return (
                        <div
                          key={f.key}
                          className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3 sm:col-span-2 lg:col-span-3 dark:border-slate-800 dark:bg-slate-800/40"
                        >
                          <Checkbox
                            checked={draft[f.key] === true}
                            onChange={(e) => set(f.key, e.target.checked)}
                            className="mt-0.5"
                          />
                          <div className="flex flex-col">
                            <label className="text-xs font-bold text-slate-900 dark:text-white cursor-pointer">
                              {f.label}
                            </label>
                            {f.hint && (
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {f.hint}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    }

                    const isLongText = f.kind === "text" && f.long;

                    return (
                      <div
                        key={f.key}
                        className={
                          isLongText ? "sm:col-span-2 lg:col-span-3" : undefined
                        }
                      >
                        <FormField label={f.label} hint={f.hint}>
                          {(fp) => {
                            if (f.kind === "choice") {
                              return (
                                <Select
                                  {...fp}
                                  value={String(draft[f.key])}
                                  onChange={(e) => set(f.key, e.target.value)}
                                >
                                  {f.options.map(([value, label]) => (
                                    <option key={value} value={value}>
                                      {label}
                                    </option>
                                  ))}
                                </Select>
                              );
                            }

                            if (f.kind === "text" && f.long) {
                              return (
                                <Textarea
                                  {...fp}
                                  rows={2}
                                  value={String(draft[f.key] ?? "")}
                                  onChange={(e) => set(f.key, e.target.value)}
                                />
                              );
                            }

                            // Number and standard text inputs with adornments
                            const isCurrency =
                              f.kind === "number" && f.adornment === "currency";
                            const isPercent =
                              f.kind === "number" && f.adornment === "percent";
                            const isMultiplier =
                              f.kind === "number" &&
                              f.adornment === "multiplier";
                            const isHours =
                              f.kind === "number" && f.adornment === "hours";
                            const isYears =
                              f.kind === "number" && f.adornment === "years";

                            return (
                              <div className="relative">
                                {isCurrency && (
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                    ₹
                                  </span>
                                )}
                                <Input
                                  {...fp}
                                  type={f.kind === "number" ? "number" : "text"}
                                  {...(f.kind === "number"
                                    ? {
                                        step: f.step ?? "1",
                                        inputMode: "decimal" as const,
                                      }
                                    : {})}
                                  className={`${isCurrency ? "pl-7" : ""} ${
                                    isPercent || isMultiplier
                                      ? "pr-8"
                                      : isHours || isYears
                                        ? "pr-14"
                                        : ""
                                  }`}
                                  value={String(draft[f.key] ?? "")}
                                  onChange={(e) => set(f.key, e.target.value)}
                                />
                                {isPercent && (
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                    %
                                  </span>
                                )}
                                {isMultiplier && (
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                    ×
                                  </span>
                                )}
                                {isHours && (
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400">
                                    hrs/day
                                  </span>
                                )}
                                {isYears && (
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-slate-400">
                                    years
                                  </span>
                                )}
                              </div>
                            );
                          }}
                        </FormField>
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Sleek Floating Bottom Action Bar (Appears when changes exist) */}
      {hasChanges && (
        <div className="sticky bottom-6 z-40 mx-auto flex w-full max-w-2xl items-center justify-between gap-4 rounded-2xl border border-sky-200 bg-white/95 px-5 py-3 shadow-2xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
            <span>Unsaved policy changes detected</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setDraft(toDraft(settings))}
              className="text-xs"
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Discard
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={update.isPending}
              className="bg-brand-500 hover:bg-brand-600 font-bold text-white text-xs shadow-xs"
            >
              <Save className="mr-1 h-3.5 w-3.5" />
              Save Settings
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

function PolicySection() {
  const query = usePayrollSettings();
  return (
    <div className="flex flex-col gap-4">
      <QueryState query={query} area="payroll settings" />
      {query.data ? (
        <PolicyForm key={query.data.version} settings={query.data} />
      ) : null}
    </div>
  );
}

type SettingsTab = "policy" | "components" | "templates" | "tax" | "pt";

export function PayrollSettingsPanel() {
  const canRead = usePermission(PAYROLL_SETTINGS_READ);
  const [tab, setTab] = useState<SettingsTab>("policy");

  if (!canRead) return <NoAccess area="payroll settings" />;

  const tabs: TabItem<SettingsTab>[] = [
    { id: "policy", label: "Policy & statutory" },
    { id: "components", label: "Components" },
    { id: "templates", label: "Templates" },
    { id: "tax", label: "Tax regimes" },
    { id: "pt", label: "Professional Tax" },
  ];

  return (
    <Tabs
      label="Payroll settings sections"
      idPrefix="payroll-settings"
      tabs={tabs}
      value={tab}
      onChange={setTab}
    >
      {tab === "policy" ? <PolicySection /> : null}
      {tab === "components" ? <ComponentsSection /> : null}
      {tab === "templates" ? <TemplatesSection /> : null}
      {tab === "tax" ? <TaxRegimesSection /> : null}
      {tab === "pt" ? <ProfessionalTaxSection /> : null}
    </Tabs>
  );
}
