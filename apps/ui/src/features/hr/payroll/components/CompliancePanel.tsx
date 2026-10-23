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
  Pagination,
  Select,
  useToast,
} from "@texawave-erp/ui-kit";
import { useMemo, useState } from "react";
import {
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  FileText,
  HelpCircle,
  Info,
  Receipt,
  RotateCcw,
  Search,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  type EmployeeOption,
  EmployeePicker,
} from "@/components/widgets/EmployeePicker";
import { usePermission } from "@/hooks/usePermission";
import type { Contribution } from "../api";
import { describeError, isoDate, money, periodLabel } from "../format";
import {
  useComplianceProfile,
  useContributions,
  useSaveComplianceProfile,
} from "../hooks";
import { ESI_WRITE, PF_WRITE } from "../permissions";
import { esiProfileSchema, fieldErrors, pfProfileSchema } from "../schema";
import {
  CONTRIBUTION_PAYMENT_STATUSES,
  type ComplianceKind,
  type ContributionPaymentStatus,
  type EsiProfile,
  type PfContribution,
  type PfProfile,
} from "../types";
import { ServerError } from "./DialogParts";
import { StatusPill, statusLabel } from "./PayrollStatusBadge";
import { PeriodFilterSelect } from "./PeriodFilterSelect";
import { QueryState } from "./QueryState";
import {
  exportComplianceCsv,
  exportEsicReturnCsv,
  exportPfEcrText,
} from "./compliance-export";

const PAGE_SIZE = 20;

/** Everything that differs between PF and ESI. */
const CONFIG = {
  pf: {
    name: "PF",
    long: "Provident Fund",
    write: PF_WRITE,
    applicableLabel: "PF applicable",
    idLabel: "UAN (Universal Account Number)",
    idHint: "12-digit Indian Universal Account Number.",
    wageLabel: "PF wage",
    rule: "Employee and employer each contribute 12% of the PF wage (Basic, capped at ₹15,000).",
  },
  esi: {
    name: "ESI",
    long: "Employee State Insurance",
    write: ESI_WRITE,
    applicableLabel: "ESI applicable",
    idLabel: "ESI Insurance (IP) Number",
    idHint: "10- or 17-digit insurance number.",
    wageLabel: "ESI wage",
    rule: "Applies while the recurring monthly wage is ₹21,000 or less: employee 0.75%, employer 3.25%.",
  },
} as const;

interface FormState {
  applicable: boolean;
  idNumber: string;
  pfNumber: string;
  effectiveFrom: string;
  effectiveTo: string;
}

function initialForm(
  kind: ComplianceKind,
  profile: PfProfile | EsiProfile | null,
): FormState {
  if (!profile)
    return {
      applicable: true,
      idNumber: "",
      pfNumber: "",
      effectiveFrom: "",
      effectiveTo: "",
    };
  const pf = kind === "pf" ? (profile as PfProfile) : null;
  const esi = kind === "esi" ? (profile as EsiProfile) : null;
  return {
    applicable: pf ? pf.pfApplicable : Boolean(esi?.esiApplicable),
    idNumber: (pf ? pf.uan : esi?.insuranceNumber) ?? "",
    pfNumber: pf?.pfNumber ?? "",
    effectiveFrom: profile.effectiveFrom.slice(0, 10),
    effectiveTo: profile.effectiveTo?.slice(0, 10) ?? "",
  };
}

/** Official EPFO 5-Account Challan Split Modal */
function PfChallanModal({
  contributions,
  periodName,
  onClose,
}: {
  contributions: PfContribution[];
  periodName: string;
  onClose: () => void;
}) {
  const totalWages = contributions.reduce(
    (acc, r) => acc + (Number(r.pfWage) || 0),
    0,
  );
  const totalEe = contributions.reduce(
    (acc, r) => acc + (Number(r.employeeContribution) || 0),
    0,
  );
  const totalEps = contributions.reduce(
    (acc, r) =>
      acc +
      (Number(r.epsContribution) ||
        Math.min(1250, (Number(r.pfWage) || 0) * 0.0833)),
    0,
  );
  const totalEpfEr = contributions.reduce(
    (acc, r) =>
      acc +
      (Number(r.epfEmployerContribution) ||
        Math.max(
          0,
          (Number(r.employerContribution) || 0) -
            (Number(r.epsContribution) ||
              Math.min(1250, (Number(r.pfWage) || 0) * 0.0833)),
        )),
    0,
  );

  // EPFO 5 Account calculations
  const ac01 = totalEe + totalEpfEr; // Employee Share 12% + Employer EPF Share 3.67%
  const ac02 = Math.max(500, Math.round(totalWages * 0.005)); // EPF Admin charges 0.5% (Min ₹500)
  const ac10 = Math.round(totalEps); // EPS 8.33%
  const ac21 = Math.round(totalWages * 0.005); // EDLI 0.5%
  const ac22 = 0; // EDLI admin charges waived
  const grandTotal = ac01 + ac02 + ac10 + ac21 + ac22;

  return (
    <Dialog
      open
      onClose={onClose}
      title="EPFO Monthly Challan Breakdown"
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-5">
        {/* Header Summary */}
        <div className="flex items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-white text-brand-600 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-sky-400">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#0a3271] dark:text-white">
                Monthly EPFO Statutory Challan
              </h3>
              <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-brand-700 dark:bg-slate-800 dark:text-sky-300">
                {periodName}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Exact 5-account breakdown for generating TRRN on the EPFO Employer
              Portal.
            </p>
          </div>
        </div>

        {/* Grand Total Box */}
        <div className="flex items-center justify-between rounded-2xl border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-900/50 dark:bg-brand-950/20">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700 dark:text-sky-300">
              Total Challan Remittance (TRRN Amount)
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-[#0a3271] dark:text-white mt-0.5">
              {money(String(grandTotal))}
            </h2>
          </div>
          <div className="text-right text-xs">
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              {contributions.length} Contributing Members
            </p>
            <p className="text-slate-500">Statutory Due: 15th of month</p>
          </div>
        </div>

        {/* 5 Accounts Breakdown Table */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-gray-100 bg-gray-50/70 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
            <p className="text-xs font-bold text-[#0a3271] dark:text-sky-300 uppercase tracking-wider">
              Statutory EPFO Accounts Split
            </p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-800 text-xs">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">
                  A/C 01 · Employees' Provident Fund (EPF)
                </p>
                <p className="text-[11px] text-slate-500">
                  Employee Share (12%): {money(String(totalEe))} + Employer EPF
                  (3.67%): {money(String(totalEpfEr))}
                </p>
              </div>
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                {money(String(ac01))}
              </span>
            </div>

            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">
                  A/C 02 · EPF Administration Charges
                </p>
                <p className="text-[11px] text-slate-500">
                  0.50% of Total EPF Wages (Subject to statutory min ₹500/month)
                </p>
              </div>
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                {money(String(ac02))}
              </span>
            </div>

            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">
                  A/C 10 · Employees' Pension Scheme (EPS)
                </p>
                <p className="text-[11px] text-slate-500">
                  8.33% of Wages (Statutory ceiling ₹1,250 per member)
                </p>
              </div>
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                {money(String(ac10))}
              </span>
            </div>

            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">
                  A/C 21 · Employees' Deposit Linked Insurance (EDLI)
                </p>
                <p className="text-[11px] text-slate-500">
                  0.50% of EDLI Wages (Capped at ₹75 per member)
                </p>
              </div>
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                {money(String(ac21))}
              </span>
            </div>

            <div className="flex items-center justify-between px-4 py-3 bg-gray-50/50 dark:bg-slate-800/40">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">
                  A/C 22 · EDLI Administration Charges
                </p>
                <p className="text-[11px] text-slate-500">
                  Administrative charges waived by Ministry of Labour &
                  Employment
                </p>
              </div>
              <span className="font-bold text-slate-500 text-sm">₹0.00</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <Button
            variant="secondary"
            onClick={() => exportPfEcrText(contributions, periodName)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#0a3271] dark:text-sky-300"
          >
            <Download className="h-3.5 w-3.5 text-brand-600" />
            Download ECR (.txt)
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Official ESIC Monthly Challan / Remittance Statement Modal */
function EsiChallanModal({
  contributions,
  periodName,
  onClose,
}: {
  contributions: Contribution<"esi">[];
  periodName: string;
  onClose: () => void;
}) {
  const covered = contributions.filter((r) => r.esiIncluded);
  const totalWages = covered.reduce(
    (acc, r) => acc + (Number(r.esiWage) || 0),
    0,
  );
  const totalEe = contributions.reduce(
    (acc, r) => acc + (Number(r.employeeContribution) || 0),
    0,
  );
  const totalEr = contributions.reduce(
    (acc, r) => acc + (Number(r.employerContribution) || 0),
    0,
  );
  const grandTotal = totalEe + totalEr;

  return (
    <Dialog
      open
      onClose={onClose}
      title="ESIC Monthly Challan & Remittance"
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-5">
        {/* Header Summary */}
        <div className="flex items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-white text-brand-600 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-sky-400">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#0a3271] dark:text-white">
                Monthly ESIC Contribution Statement
              </h3>
              <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-brand-700 dark:bg-slate-800 dark:text-sky-300">
                {periodName}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Statutory 4.00% remittance breakdown for monthly payment on the
              ESIC Employer Portal.
            </p>
          </div>
        </div>

        {/* Grand Total Box */}
        <div className="flex items-center justify-between rounded-2xl border border-brand-200 bg-brand-50/50 p-4 dark:border-brand-900/50 dark:bg-brand-950/20">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700 dark:text-sky-300">
              Total Challan Remittance (Form 5 Deposit)
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-[#0a3271] dark:text-white mt-0.5">
              {money(String(grandTotal))}
            </h2>
          </div>
          <div className="text-right text-xs">
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              {covered.length} Insured Persons (IPs)
            </p>
            <p className="text-slate-500">Statutory Due: 15th of month</p>
          </div>
        </div>

        {/* 2-Part Breakdown Table */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-gray-100 bg-gray-50/70 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">
            <p className="text-xs font-bold text-[#0a3271] dark:text-sky-300 uppercase tracking-wider">
              Statutory Contribution Breakdown
            </p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-800 text-xs">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">
                  Employee Contribution (0.75%)
                </p>
                <p className="text-[11px] text-slate-500">
                  Deducted from monthly gross wages of covered employees (≤
                  ₹21,000/mo)
                </p>
              </div>
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                {money(String(totalEe))}
              </span>
            </div>

            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">
                  Employer Contribution (3.25%)
                </p>
                <p className="text-[11px] text-slate-500">
                  Employer statutory share deposited into the ESI medical
                  benefit reserve
                </p>
              </div>
              <span className="font-bold text-slate-900 dark:text-white text-sm">
                {money(String(totalEr))}
              </span>
            </div>

            <div className="flex items-center justify-between px-4 py-3 bg-gray-50/50 dark:bg-slate-800/40">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">
                  Total Aggregate Remittance (4.00%)
                </p>
                <p className="text-[11px] text-slate-500">
                  Total gross wage pool: {money(String(totalWages))} across{" "}
                  {covered.length} active insured members
                </p>
              </div>
              <span className="font-bold text-brand-600 dark:text-sky-400 text-sm">
                {money(String(grandTotal))}
              </span>
            </div>
          </div>
        </div>

        {/* Statutory Filing Guidelines Box */}
        <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-900/40">
          <p className="font-bold text-[#0a3271] dark:text-sky-300">
            ESIC Portal Remittance Process
          </p>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
            Upload the monthly return file via the official ESIC Employer Portal
            (Monthly Contribution &gt; File Monthly Return). Generate the online
            challan and complete payment via SBI internet banking on or before
            the 15th.
          </p>
        </div>

        <div className="flex items-center justify-between pt-1">
          <Button
            variant="secondary"
            onClick={() => exportEsicReturnCsv(contributions, periodName)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#0a3271] dark:text-sky-300"
          >
            <Download className="h-3.5 w-3.5 text-brand-600" />
            Download Return (.csv)
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Statutory Rules & EPFO / ESI Reference Guide Dialog */
function ComplianceGuideModal({
  kind,
  onClose,
}: {
  kind: ComplianceKind;
  onClose: () => void;
}) {
  const isPf = kind === "pf";

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${isPf ? "Provident Fund (EPF/EPS)" : "Employee State Insurance (ESI)"} Statutory Guide`}
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-4 text-xs">
        <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-600 dark:text-sky-400" />
            <h4 className="font-bold text-[#0a3271] dark:text-white">
              {isPf
                ? "Employees' Provident Funds & Miscellaneous Provisions Act, 1952"
                : "Employees' State Insurance Act, 1948"}
            </h4>
          </div>
          <p className="mt-1 text-slate-600 dark:text-slate-400 leading-relaxed">
            {isPf
              ? "Mandatory for all establishments with 20 or more employees. Covers employees with monthly basic wages up to ₹15,000."
              : "Applicable to non-seasonal factories and establishments employing 10 or more persons with gross monthly wages up to ₹21,000."}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
            <p className="font-bold text-slate-900 dark:text-white">
              Employee Share
            </p>
            <p className="text-xl font-bold text-brand-600 mt-1">
              {isPf ? "12.00%" : "0.75%"}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {isPf
                ? "Deducted from monthly PF wage (Basic + DA). Capped at ₹1,800/mo."
                : "Deducted from monthly gross wage (excluding annual bonus/gratuity)."}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
            <p className="font-bold text-slate-900 dark:text-white">
              Employer Share
            </p>
            <p className="text-xl font-bold text-emerald-600 mt-1">
              {isPf ? "12.00% + Admin" : "3.25%"}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              {isPf
                ? "Split into EPS 8.33% (Pension) + EPF 3.67% + EDLI 0.5% + Admin 0.5%."
                : "Contributed by the employer towards medical benefits and coverage."}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="font-bold text-amber-800 dark:text-amber-300">
            Critical Statutory Filing Deadlines
          </p>
          <ul className="mt-1 list-disc list-inside text-amber-700 dark:text-amber-400 space-y-1">
            <li>
              Remittance & ECR Filing: Due on or before the{" "}
              <strong>15th of the following month</strong>.
            </li>
            <li>
              Late payment attracts penal damages under Section 14B and simple
              interest at 12% p.a. under Section 7Q.
            </li>
            {isPf && (
              <li>
                Employees aged 58 and above are excluded from EPS (A/C 10);
                their full 12% employer share diverts into EPF (A/C 01).
              </li>
            )}
          </ul>
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

/** Create/update form for one employee's profile */
function ProfileForm({
  kind,
  employee,
  profile,
  canWrite,
}: {
  kind: ComplianceKind;
  employee: EmployeeOption;
  profile: PfProfile | EsiProfile | null;
  canWrite: boolean;
}) {
  const cfg = CONFIG[kind];
  const [form, setForm] = useState(() => initialForm(kind, profile));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const save = useSaveComplianceProfile(kind);
  const { toast } = useToast();
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed =
      kind === "pf"
        ? pfProfileSchema.safeParse({
            pfApplicable: form.applicable,
            uan: form.idNumber,
            pfNumber: form.pfNumber,
            effectiveFrom: form.effectiveFrom,
            effectiveTo: form.effectiveTo,
          })
        : esiProfileSchema.safeParse({
            esiApplicable: form.applicable,
            insuranceNumber: form.idNumber,
            effectiveFrom: form.effectiveFrom,
            effectiveTo: form.effectiveTo,
          });
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error);
      setErrors({
        ...errs,
        idNumber: errs.uan ?? errs.insuranceNumber ?? "",
      });
      return;
    }
    setErrors({});
    setServerError(null);
    try {
      await save.mutateAsync({ employeeId: employee.id, body: parsed.data });
      toast({
        title: `${cfg.name} profile saved for ${employee.fullName}`,
        variant: "success",
      });
    } catch (err) {
      setServerError(describeError(err));
    }
  }

  const disabled = !canWrite || save.isPending;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label={`${cfg.name} profile for ${employee.fullName}`}
      className="flex flex-col gap-5 pt-1"
    >
      {/* Live Statutory Contribution Calculation Simulation */}
      <div className="rounded-2xl border border-sky-100 bg-sky-50/40 p-4 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-brand-600 dark:text-sky-400" />
            <span className="text-xs font-bold text-[#0a3271] dark:text-sky-300 uppercase tracking-wider">
              {cfg.name} Standard Monthly Calculation Preview
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Statutory rate:{" "}
            {kind === "pf" ? "12% EE + 12% ER" : "0.75% EE + 3.25% ER"}
          </span>
        </div>

        {kind === "pf" ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="rounded-xl border border-gray-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-800">
              <p className="text-[10px] font-bold text-slate-500 uppercase">
                Wage Ceiling
              </p>
              <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                ₹15,000
              </p>
              <p className="text-[10px] text-slate-400">Statutory cap</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-800">
              <p className="text-[10px] font-bold text-slate-500 uppercase">
                Employee Share (12%)
              </p>
              <p className="text-xs font-bold text-brand-600 dark:text-sky-400 mt-0.5">
                ₹1,800/mo
              </p>
              <p className="text-[10px] text-slate-400">EPF deduction</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-800">
              <p className="text-[10px] font-bold text-slate-500 uppercase">
                Employer Share (12%)
              </p>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                ₹1,800/mo
              </p>
              <p className="text-[10px] text-slate-400">
                EPS ₹1,250 + EPF ₹550
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-800">
              <p className="text-[10px] font-bold text-slate-500 uppercase">
                Admin & EDLI
              </p>
              <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                ₹150/mo
              </p>
              <p className="text-[10px] text-slate-400">0.5% + 0.5%</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="rounded-xl border border-gray-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-800">
              <p className="text-[10px] font-bold text-slate-500 uppercase">
                Wage Threshold
              </p>
              <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                ₹21,000
              </p>
              <p className="text-[10px] text-slate-400">Gross limit</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-800">
              <p className="text-[10px] font-bold text-slate-500 uppercase">
                Employee Share (0.75%)
              </p>
              <p className="text-xs font-bold text-brand-600 dark:text-sky-400 mt-0.5">
                ₹150/mo
              </p>
              <p className="text-[10px] text-slate-400">@ ₹20,000 gross</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-800">
              <p className="text-[10px] font-bold text-slate-500 uppercase">
                Employer Share (3.25%)
              </p>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                ₹650/mo
              </p>
              <p className="text-[10px] text-slate-400">@ ₹20,000 gross</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-800">
              <p className="text-[10px] font-bold text-slate-500 uppercase">
                Total Deposit (4.00%)
              </p>
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                ₹800/mo
              </p>
              <p className="text-[10px] text-slate-400">Combined ESIC pool</p>
            </div>
          </div>
        )}
      </div>

      {/* Applicable Toggle Card */}
      <div className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/60 dark:border-slate-800 dark:bg-slate-900/40">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.applicable}
            disabled={disabled}
            onChange={(e) => set("applicable", e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              {cfg.applicableLabel} (Active Contributing Member)
            </span>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Enable statutory contributions and include in monthly payroll
              runs.
            </p>
          </div>
        </label>
      </div>

      {/* Identification & Date Inputs */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label={cfg.idLabel}
          hint={cfg.idHint}
          error={errors.idNumber || undefined}
        >
          {(f) => (
            <div className="relative">
              <Input
                {...f}
                inputMode="numeric"
                placeholder={
                  kind === "pf" ? "e.g. 100123456789" : "e.g. 1100123456"
                }
                value={form.idNumber}
                disabled={disabled}
                onChange={(e) =>
                  set("idNumber", e.target.value.replace(/\D/g, ""))
                }
                className="font-semibold"
              />
              {form.idNumber.length > 0 && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                  {kind === "pf"
                    ? `${form.idNumber.length}/12`
                    : `${form.idNumber.length}/10`}
                </span>
              )}
            </div>
          )}
        </FormField>

        {kind === "pf" ? (
          <FormField
            label="PF Member ID"
            hint="Format: TN/MAS/0012345/000/0000123"
            error={errors.pfNumber}
          >
            {(f) => (
              <Input
                {...f}
                placeholder="e.g. TN/MAS/0012345/000/0000123"
                value={form.pfNumber}
                disabled={disabled}
                onChange={(e) => set("pfNumber", e.target.value)}
              />
            )}
          </FormField>
        ) : null}

        <FormField
          label="Effective from"
          hint={profile ? undefined : "Defaults to registration date"}
          error={errors.effectiveFrom}
        >
          {(f) => (
            <Input
              {...f}
              type="date"
              value={form.effectiveFrom}
              disabled={disabled}
              onChange={(e) => set("effectiveFrom", e.target.value)}
            />
          )}
        </FormField>

        <FormField
          label="Effective to"
          hint="Leave empty if indefinitely active"
          error={errors.effectiveTo}
        >
          {(f) => (
            <Input
              {...f}
              type="date"
              value={form.effectiveTo}
              disabled={disabled}
              onChange={(e) => set("effectiveTo", e.target.value)}
            />
          )}
        </FormField>
      </div>

      <ServerError message={serverError} />

      {canWrite ? (
        <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-slate-800">
          <span className="text-[11px] text-slate-500">
            {profile
              ? `Last updated on ${isoDate(profile.updatedAt)}`
              : "New registration"}
          </span>
          <Button
            type="submit"
            loading={save.isPending}
            className="bg-brand-500 hover:bg-[#1258d4] text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-xs"
          >
            Save {cfg.name} Profile
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function ProfileSection({ kind }: { kind: ComplianceKind }) {
  const cfg = CONFIG[kind];
  const canWrite = usePermission(cfg.write);
  const [employee, setEmployee] = useState<EmployeeOption | null>(null);
  const profile = useComplianceProfile(kind, employee?.id ?? null);

  return (
    <Card>
      <section
        aria-labelledby={`${kind}-profile-heading`}
        className="flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2
              id={`${kind}-profile-heading`}
              className="text-base font-bold text-[#0a3271] dark:text-white"
            >
              {cfg.name} Member Registration
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {cfg.rule}
            </p>
          </div>
          <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-bold text-brand-700 dark:bg-slate-800 dark:text-sky-300">
            {cfg.long}
          </span>
        </div>

        <div className="max-w-md">
          <FormField label="Select Employee">
            {(f) => (
              <EmployeePicker {...f} value={employee} onChange={setEmployee} />
            )}
          </FormField>
        </div>

        {employee ? (
          <>
            <QueryState query={profile} area={`this ${cfg.name} profile`} />
            {profile.isSuccess ? (
              <ProfileForm
                key={`${employee.id}-${profile.data?.updatedAt ?? "new"}`}
                kind={kind}
                employee={employee}
                profile={profile.data}
                canWrite={canWrite}
              />
            ) : null}
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center dark:border-slate-800 dark:bg-slate-900/30">
            <Users className="mx-auto h-7 w-7 text-gray-400 mb-1.5" />
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Select an employee above
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              View or update their statutory {cfg.name} identifiers, UAN, and
              contribution validity.
            </p>
          </div>
        )}
      </section>
    </Card>
  );
}

function ContributionsSection({ kind }: { kind: ComplianceKind }) {
  const cfg = CONFIG[kind];
  const [page, setPage] = useState(1);
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [status, setStatus] = useState<ContributionPaymentStatus | "">("");
  const [search, setSearch] = useState("");
  const [showChallan, setShowChallan] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const query = useContributions(kind, {
    page,
    limit: PAGE_SIZE,
    ...(periodId ? { payrollPeriodId: periodId } : {}),
    ...(status ? { paymentStatus: status } : {}),
  });

  const allRows = (query.data?.data ?? []) as Contribution<ComplianceKind>[];

  const included = (r: Contribution<ComplianceKind>) =>
    "pfIncluded" in r ? r.pfIncluded : r.esiIncluded;
  const wage = (r: Contribution<ComplianceKind>) =>
    "pfWage" in r ? r.pfWage : r.esiWage;

  // Client-side search filter
  const filteredRows = useMemo(() => {
    if (!search.trim()) return allRows;
    const q = search.trim().toLowerCase();
    return allRows.filter(
      (r) =>
        r.employee.fullName.toLowerCase().includes(q) ||
        r.employee.employeeCode.toLowerCase().includes(q),
    );
  }, [allRows, search]);

  // Aggregate KPI Calculations
  const coveredCount = allRows.filter(included).length;
  const totalWages = allRows.reduce(
    (acc, r) => acc + (Number(wage(r)) || 0),
    0,
  );
  const totalEe = allRows.reduce(
    (acc, r) => acc + (Number(r.employeeContribution) || 0),
    0,
  );
  const totalEr = allRows.reduce(
    (acc, r) => acc + (Number(r.employerContribution) || 0),
    0,
  );
  const totalDeposit = totalEe + totalEr;

  const currentPeriodName = allRows[0]
    ? periodLabel(allRows[0].payrollPeriod)
    : "Active Period";

  const hasActiveFilters =
    periodId !== null || status !== "" || search.trim() !== "";

  const handleResetFilters = () => {
    setPeriodId(null);
    setStatus("");
    setSearch("");
    setPage(1);
  };

  return (
    <section
      aria-labelledby={`${kind}-contrib-heading`}
      className="flex flex-col gap-5"
    >
      {/* 1. 4 Interactive Statutory KPI Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Coverage Card */}
        <div className="flex items-center justify-between rounded-2xl border border-sky-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
              {cfg.name} Coverage
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-[#0a3271] dark:text-white">
              {coveredCount}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {allRows.length - coveredCount} exempt / not covered
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-500 dark:border-slate-700 dark:bg-slate-800">
            <Users className="h-5 w-5" />
          </div>
        </div>

        {/* Wage Pool Card */}
        <div className="flex items-center justify-between rounded-2xl border border-sky-200/90 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
              {cfg.wageLabel} Pool
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-brand-600 dark:text-sky-300">
              {money(String(totalWages))}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {kind === "pf" ? "Capped at ₹15,000/mo" : "Eligible wage pool"} ·{" "}
              {allRows.length} rows
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-brand-500 dark:border-slate-700 dark:bg-slate-800">
            <Coins className="h-5 w-5" />
          </div>
        </div>

        {/* Employee & Employer Contributions Split */}
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200/90 bg-white p-4 shadow-2xs dark:border-emerald-900/60 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Employee Share {kind === "pf" ? "(12%)" : "(0.75%)"}
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {money(String(totalEe))}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Employer share {kind === "pf" ? "(12%)" : "(3.25%)"}:{" "}
              {money(String(totalEr))}
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        {/* Total Net Statutory Deposit */}
        <div className="flex items-center justify-between rounded-2xl border border-amber-200/90 bg-white p-4 shadow-2xs dark:border-amber-900/60 dark:bg-slate-900/60">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Net Statutory Deposit
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {money(String(totalDeposit))}
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {kind === "pf"
                ? "Total 24% + Admin to EPFO"
                : "Total 4.00% to ESIC"}{" "}
              by 15th
            </p>
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950/40">
            <Receipt className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* 2. Unified Single-Baseline Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-1 flex-wrap items-center gap-3 min-w-70">
          {/* Live Search */}
          <div className="relative flex-1 min-w-50">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search member by name or code..."
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

          {/* Period Filter */}
          <div className="w-full sm:w-44">
            <PeriodFilterSelect
              value={periodId}
              onChange={(id) => {
                setPeriodId(id);
                setPage(1);
              }}
            />
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-40">
            <Select
              aria-label="Filter by payment status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as ContributionPaymentStatus | "");
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              {CONTRIBUTION_PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
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
          {kind === "pf" ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowChallan(true)}
                disabled={allRows.length === 0}
                className="flex items-center gap-1.5 text-xs font-semibold"
              >
                <Receipt className="h-3.5 w-3.5 text-brand-600" />
                EPFO Challan
              </Button>

              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  exportPfEcrText(
                    allRows as PfContribution[],
                    currentPeriodName,
                  )
                }
                disabled={allRows.length === 0}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#0a3271] dark:text-sky-300"
              >
                <Download className="h-3.5 w-3.5 text-brand-600" />
                Export ECR (.txt)
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowChallan(true)}
                disabled={allRows.length === 0}
                className="flex items-center gap-1.5 text-xs font-semibold"
              >
                <Receipt className="h-3.5 w-3.5 text-brand-600" />
                ESIC Challan
              </Button>

              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  exportEsicReturnCsv(
                    allRows as Contribution<"esi">[],
                    currentPeriodName,
                  )
                }
                disabled={allRows.length === 0}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#0a3271] dark:text-sky-300"
              >
                <Download className="h-3.5 w-3.5 text-brand-600" />
                Export ESIC Return (.csv)
              </Button>
            </>
          )}

          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              exportComplianceCsv(allRows, kind, currentPeriodName)
            }
            disabled={allRows.length === 0}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <FileText className="h-3.5 w-3.5 text-slate-600" />
            Export CSV
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowGuide(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-brand-600"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Guide
          </Button>
        </div>
      </div>

      <QueryState query={query} area={`${cfg.name} contributions`} />

      {/* 3. DataTable */}
      {query.isSuccess && filteredRows.length === 0 ? (
        <Card>
          <EmptyState
            title={`No ${cfg.name} contributions`}
            description={
              hasActiveFilters
                ? "No contribution records match your active filters."
                : "Contributions appear here once monthly payroll is run for a period."
            }
          />
        </Card>
      ) : null}

      {query.isSuccess && filteredRows.length > 0 ? (
        <>
          <DataTable<Contribution<ComplianceKind>>
            caption={`${cfg.name} contributions`}
            rows={filteredRows}
            getRowKey={(r) => String(r.id)}
            columns={[
              {
                header: "Employee",
                cell: (r) => (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {r.employee.fullName}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {r.employee.employeeCode}
                    </span>
                  </div>
                ),
              },
              {
                header: "Period",
                cell: (r) => (
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {periodLabel(r.payrollPeriod)}
                  </span>
                ),
              },
              {
                header: "Covered",
                cell: (r) =>
                  included(r) ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <Check className="h-3 w-3" />
                      Covered
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-500 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-400">
                      Exempt
                    </span>
                  ),
              },
              {
                header: cfg.wageLabel,
                cell: (r) => (
                  <span className="font-bold text-slate-900 dark:text-white">
                    {money(wage(r))}
                  </span>
                ),
                className: "text-right whitespace-nowrap",
                headerClassName: "text-right",
              },
              {
                header: "Employee Share",
                cell: (r) => (
                  <span className="font-bold text-brand-600 dark:text-sky-400">
                    {money(r.employeeContribution)}
                  </span>
                ),
                className: "text-right whitespace-nowrap",
                headerClassName: "text-right",
              },
              {
                header: "Employer Share",
                cell: (r) =>
                  "epsContribution" in r && r.epsContribution !== undefined ? (
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {money(r.employerContribution)}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        EPS {money(r.epsContribution)} · EPF{" "}
                        {money(r.epfEmployerContribution)}
                      </span>
                    </div>
                  ) : (
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {money(r.employerContribution)}
                    </span>
                  ),
                className: "text-right whitespace-nowrap",
                headerClassName: "text-right",
              },
              {
                header: "Payment",
                cell: (r) => <StatusPill status={r.paymentStatus} />,
              },
              {
                header: "Salary Credited",
                cell: (r) =>
                  r.salaryCredited ? (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Yes
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">Pending</span>
                  ),
              },
            ]}
          />

          <Pagination
            page={page}
            totalPages={query.data.meta?.totalPages ?? 1}
            onPageChange={setPage}
          />
        </>
      ) : null}

      {/* Challan Modals */}
      {showChallan && kind === "pf" ? (
        <PfChallanModal
          contributions={allRows as PfContribution[]}
          periodName={currentPeriodName}
          onClose={() => setShowChallan(false)}
        />
      ) : null}

      {showChallan && kind === "esi" ? (
        <EsiChallanModal
          contributions={allRows as Contribution<"esi">[]}
          periodName={currentPeriodName}
          onClose={() => setShowChallan(false)}
        />
      ) : null}

      {/* Compliance Guide Modal */}
      {showGuide ? (
        <ComplianceGuideModal kind={kind} onClose={() => setShowGuide(false)} />
      ) : null}
    </section>
  );
}

/** HR → Compliance → PF / ESI: one employee's registration, plus the
 * contributions payroll runs produced. */
export function CompliancePanel({ kind }: { kind: ComplianceKind }) {
  return (
    <div className="flex flex-col gap-6">
      <ProfileSection kind={kind} />
      <ContributionsSection kind={kind} />
    </div>
  );
}
