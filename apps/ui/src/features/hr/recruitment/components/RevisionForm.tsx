"use client";

import { useEffect, useRef, useState } from "react";
import {
  Button,
  DatePicker,
  FormField,
  Input,
  Select,
} from "@texawave-erp/ui-kit";
import {
  User,
  Calendar,
  Building2,
  TrendingUp,
  Stamp,
  X,
} from "lucide-react";
import { FormSection } from "../../components/FormSection";
import {
  issuesByField,
  revisionFormSchema,
  toAmount,
  type RevisionFormValues,
} from "../schema";
import {
  convertAmount,
  monthlyTotal,
  round2,
  splitAmount,
  withDefined,
  type SalaryBasis,
} from "../salary";
import type { CreateRevisionLetterInput, RevisionLetterView } from "../types";
import { apiErrorMessage, formatRupees, todayDateOnly } from "../utils";

export interface RevisionEmployee {
  id: number;
  name: string;
  designation: string;
  department?: string;
  location?: string;
  currentCtc?: number | string;
}

export interface RevisionFormExtra {
  documentNo: string;
  currentCtc: string;
  revisedCtc: string;
  incrementPct: string;
  incrementAmt: string;
  revisionType: string;
  remarks: string;
  signatureImageUrl?: string | undefined;
  sealImageUrl?: string | undefined;
}

export interface RevisionFormProps {
  /** The employee the letter is issued to (create). */
  employee?: RevisionEmployee;
  /** The existing letter being edited. Its employee cannot change. */
  initial?: RevisionLetterView;
  onSubmit: (input: CreateRevisionLetterInput) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  onValuesChange?: (
    values: RevisionFormValues,
    extra: RevisionFormExtra,
  ) => void;
  signatureImageUrl?: string;
  sealImageUrl?: string;
  onSignatureChange?: (url: string) => void;
  onSealChange?: (url: string) => void;
}

/** Legacy defaults, mirrored from revision-letters.rules.ts REVISION_LETTER_DEFAULTS. */
export const LEGACY_REVISION_DEFAULTS = {
  location: "Chennai",
  signatoryName: "Amanullah Khan",
  signatoryDesignation: "Co-Founder",
} as const;

/** Legacy default effective date: the 1st of the month after today. */
export function firstOfNextMonth(): string {
  const now = new Date();
  const first = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  return first.toISOString().slice(0, 10);
}

export function toDisplayDate(val: string): string {
  if (!val) return "";
  const yyyymmdd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(val.trim());
  if (yyyymmdd && yyyymmdd[1] && yyyymmdd[2] && yyyymmdd[3]) {
    return `${yyyymmdd[3]}/${yyyymmdd[2]}/${yyyymmdd[1]}`;
  }
  return val;
}

export function toDateOnly(val: string): string {
  if (!val) return "";
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(val.trim());
  if (ddmmyyyy && ddmmyyyy[1] && ddmmyyyy[2] && ddmmyyyy[3]) {
    const day = ddmmyyyy[1].padStart(2, "0");
    const month = ddmmyyyy[2].padStart(2, "0");
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }
  return val.trim();
}

export function defaultRevisionDocNo(id?: number): string {
  const year = new Date().getFullYear().toString().slice(2);
  const nextYear = (new Date().getFullYear() + 1).toString().slice(2);
  const suffix = id ? String(id).padStart(3, "0") : "001";
  return `TW/HR/REV/${year}-${nextYear}/${suffix}`;
}

export function revisionValuesFrom(
  letter: RevisionLetterView,
): RevisionFormValues {
  return {
    employeeId: letter.employee.id,
    designation: letter.designation,
    location: letter.location,
    letterDate: letter.letterDate,
    effectiveDate: letter.effectiveDate,
    basic: letter.components.basic,
    da: letter.components.da,
    hra: letter.components.hra,
    ca: letter.components.ca,
    signatoryName: letter.signatoryName,
    signatoryDesignation: letter.signatoryDesignation,
  };
}

export function emptyRevisionValues(
  employee: RevisionEmployee,
): RevisionFormValues {
  return {
    employeeId: employee.id,
    designation: employee.designation,
    location: employee.location || LEGACY_REVISION_DEFAULTS.location,
    letterDate: todayDateOnly(),
    effectiveDate: firstOfNextMonth(),
    basic: "",
    da: "",
    hra: "",
    ca: "",
    signatoryName: LEGACY_REVISION_DEFAULTS.signatoryName,
    signatoryDesignation: LEGACY_REVISION_DEFAULTS.signatoryDesignation,
  };
}

export const REVISION_TYPES = [
  "Annual Appraisal",
  "Promotion",
  "Market Correction",
  "Performance Bonus",
  "Off-cycle Adjustment",
];

/**
 * Revision letter form conforming to current 3-card layout and integrating
 * all fields from Reference UI:
 * - Section 1: Employee Information / Revision Details
 * - Section 2: Compensation Adjustments (Current CTC, Revised CTC, Increment %, Basis Toggle, Summary Card, Breakdown)
 * - Section 3: Remarks, Signatory & Company Seal / Signature Uploads
 */
export function RevisionForm({
  employee,
  initial,
  onSubmit,
  onCancel,
  submitLabel,
  onValuesChange,
  signatureImageUrl,
  sealImageUrl,
  onSignatureChange,
  onSealChange,
}: RevisionFormProps) {
  const [values, setValues] = useState<RevisionFormValues>(() => {
    if (initial) return revisionValuesFrom(initial);
    if (employee) return emptyRevisionValues(employee);
    throw new Error("RevisionForm needs an employee or an initial letter");
  });

  const [documentNo, setDocumentNo] = useState<string>(() =>
    initial?.documentNo || defaultRevisionDocNo(employee?.id),
  );

  const [basis, setBasis] = useState<SalaryBasis>("monthly");
  const [amount, setAmount] = useState<string>(() => {
    if (initial) {
      return round2(monthlyTotal(revisionValuesFrom(initial)));
    }
    return "";
  });

  const [revisionType, setRevisionType] = useState<string>("Annual Appraisal");
  const [currentCtc, setCurrentCtc] = useState<string>(() => {
    if (employee?.currentCtc) return String(employee.currentCtc);
    return "1000000";
  });
  const [revisedCtc, setRevisedCtc] = useState<string>(() => {
    if (initial?.grossAnnual) return initial.grossAnnual;
    return "";
  });
  const [incrementPct, setIncrementPct] = useState<string>("");
  const [incrementAmt, setIncrementAmt] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const employeeName = initial?.employeeName ?? employee?.name ?? "Super Admin";
  const departmentName = employee?.department ?? "Software";
  const monthlyNet = monthlyTotal(values);

  // Synchronize live preview updates to parent via ref to prevent infinite loops
  const onValuesChangeRef = useRef(onValuesChange);
  useEffect(() => {
    onValuesChangeRef.current = onValuesChange;
  });

  useEffect(() => {
    onValuesChangeRef.current?.(values, {
      documentNo,
      currentCtc,
      revisedCtc,
      incrementPct,
      incrementAmt,
      revisionType,
      remarks,
      signatureImageUrl,
      sealImageUrl,
    });
  }, [
    values,
    documentNo,
    currentCtc,
    revisedCtc,
    incrementPct,
    incrementAmt,
    revisionType,
    remarks,
    signatureImageUrl,
    sealImageUrl,
  ]);

  function set<K extends keyof RevisionFormValues>(
    key: K,
    value: RevisionFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function applyAmount(next: string, nextBasis: SalaryBasis) {
    setAmount(next);
    setValues((prev) => ({ ...prev, ...splitAmount(next, nextBasis) }));
  }

  function switchBasis(next: SalaryBasis) {
    if (next === basis) return;
    setBasis(next);
    applyAmount(convertAmount(amount, next), next);
  }

  // Handle direct change of amount input
  function handleAmountChange(nextAmount: string) {
    applyAmount(nextAmount, basis);
    const num = parseFloat(nextAmount) || 0;
    const annualVal = basis === "monthly" ? num * 12 : num;
    setRevisedCtc(annualVal ? annualVal.toFixed(2) : "");

    const currNum = parseFloat(currentCtc) || 0;
    if (currNum > 0 && annualVal > 0) {
      const diff = annualVal - currNum;
      const pct = (diff / currNum) * 100;
      setIncrementAmt(diff.toFixed(2));
      setIncrementPct(pct.toFixed(2));
    }
  }

  // Handle Current CTC change
  function handleCurrentCtcChange(newCurr: string) {
    setCurrentCtc(newCurr);
    const currNum = parseFloat(newCurr) || 0;
    const revNum = parseFloat(revisedCtc) || 0;
    if (currNum > 0 && revNum > 0) {
      const diff = revNum - currNum;
      const pct = (diff / currNum) * 100;
      setIncrementAmt(diff.toFixed(2));
      setIncrementPct(pct.toFixed(2));
    }
  }

  // Handle Revised CTC change and calculate Increment % and Amount
  function handleRevisedCtcChange(newVal: string) {
    setRevisedCtc(newVal);
    const currNum = parseFloat(currentCtc) || 0;
    const revNum = parseFloat(newVal) || 0;
    if (currNum > 0 && revNum > 0) {
      const diff = revNum - currNum;
      const pct = (diff / currNum) * 100;
      setIncrementAmt(diff.toFixed(2));
      setIncrementPct(pct.toFixed(2));
      // Auto-split into monthly basis for components
      const monthlyRev = (revNum / 12).toFixed(2);
      applyAmount(monthlyRev, "monthly");
    } else if (revNum > 0) {
      const monthlyRev = (revNum / 12).toFixed(2);
      applyAmount(monthlyRev, "monthly");
    }
  }

  // Handle Increment % change and calculate Revised CTC and Amount
  function handleIncrementPctChange(newPct: string) {
    setIncrementPct(newPct);
    const currNum = parseFloat(currentCtc) || 0;
    const pctNum = parseFloat(newPct) || 0;
    if (currNum > 0 && !isNaN(pctNum)) {
      const diff = (currNum * pctNum) / 100;
      const revNum = currNum + diff;
      setIncrementAmt(diff.toFixed(2));
      setRevisedCtc(revNum.toFixed(2));
      const monthlyRev = (revNum / 12).toFixed(2);
      applyAmount(monthlyRev, "monthly");
    }
  }

  // Handle Increment Amount change
  function handleIncrementAmtChange(newAmt: string) {
    setIncrementAmt(newAmt);
    const currNum = parseFloat(currentCtc) || 0;
    const amtNum = parseFloat(newAmt) || 0;
    if (currNum > 0 && !isNaN(amtNum)) {
      const revNum = currNum + amtNum;
      const pct = (amtNum / currNum) * 100;
      setIncrementPct(pct.toFixed(2));
      setRevisedCtc(revNum.toFixed(2));
      const monthlyRev = (revNum / 12).toFixed(2);
      applyAmount(monthlyRev, "monthly");
    }
  }

  const handleImageUpload = (
    type: "signature" | "seal",
    file: File | null,
  ) => {
    if (!file) {
      if (type === "signature") onSignatureChange?.("");
      else onSealChange?.("");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (type === "signature") onSignatureChange?.(result);
      else onSealChange?.(result);
    };
    reader.readAsDataURL(file);
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const normalizedValues = {
      ...values,
      letterDate: toDateOnly(values.letterDate),
      effectiveDate: toDateOnly(values.effectiveDate),
    };
    const result = revisionFormSchema.safeParse(normalizedValues);
    if (!result.success) {
      setErrors(issuesByField(result.error));
      return;
    }
    setErrors({});
    setSubmitError(null);
    setSubmitting(true);
    try {
      const v = result.data;
      await onSubmit({
        employeeId: v.employeeId,
        designation: v.designation,
        location: v.location,
        letterDate: v.letterDate,
        effectiveDate: v.effectiveDate,
        ...withDefined("basic", toAmount(v.basic)),
        ...withDefined("da", toAmount(v.da)),
        ...withDefined("hra", toAmount(v.hra)),
        ...withDefined("ca", toAmount(v.ca)),
        signatoryName: v.signatoryName,
        signatoryDesignation: v.signatoryDesignation,
      });
    } catch (error) {
      setSubmitError(
        apiErrorMessage(
          error,
          "Could not save the revision letter. Try again.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {/* ================= 1. REVISION DETAILS ================= */}
      <FormSection
        stepNumber="1"
        title="Revision Details"
        description="Enter the revision and employee details."
        icon={User}
      >
        {/* Row 1: Employee Name (Full Width) */}
        <div>
          <label className="block text-theme-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Employee Name <span className="text-error-500">*</span>
          </label>
          <div className="flex h-10 w-full items-center rounded-xl border border-gray-200 bg-gray-50/80 px-3.5 text-theme-sm font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
            {employeeName}
          </div>
        </div>

        {/* Row 2: Designation & Department (2 Equal Columns) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-theme-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Designation <span className="text-error-500">*</span>
            </label>
            <Input
              placeholder="e.g. Managing Director"
              value={values.designation}
              onChange={(e) => set("designation", e.target.value)}
              disabled={submitting}
              className={`rounded-xl ${errors.designation ? "border-error-500" : ""}`}
            />
            {errors.designation && (
              <p className="text-theme-xs text-error-500 mt-1">
                {errors.designation}
              </p>
            )}
          </div>

          <div>
            <label className="block text-theme-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Department
            </label>
            <div className="flex h-10 w-full items-center rounded-xl border border-gray-200 bg-gray-50/80 px-3.5 text-theme-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {departmentName}
            </div>
          </div>
        </div>

        {/* Row 3: Document No & Location (2 Equal Columns) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-theme-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Document No.
            </label>
            <Input
              placeholder="e.g. TW/HR/REV/26-27/001"
              value={documentNo}
              onChange={(e) => setDocumentNo(e.target.value)}
              disabled={submitting}
              className="rounded-xl"
            />
          </div>

          <div>
            <label className="block text-theme-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Location <span className="text-error-500">*</span>
            </label>
            <Input
              placeholder="e.g. Chennai"
              value={values.location}
              onChange={(e) => set("location", e.target.value)}
              disabled={submitting}
              className={`rounded-xl ${errors.location ? "border-error-500" : ""}`}
            />
            {errors.location && (
              <p className="text-theme-xs text-error-500 mt-1">{errors.location}</p>
            )}
          </div>
        </div>

        {/* Row 4: Letter Date & Effective Date (2 Equal Columns) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="relative focus-within:z-30">
            <label className="block text-theme-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Letter Date
            </label>
            <DatePicker
              value={values.letterDate}
              onChangeDate={(date) => set("letterDate", date)}
              placeholder="dd/mm/yyyy"
              disabled={submitting}
            />
            {errors.letterDate && (
              <p className="text-theme-xs text-error-500 mt-1">
                {errors.letterDate}
              </p>
            )}
          </div>

          <div className="relative focus-within:z-30">
            <label className="block text-theme-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Effective Date <span className="text-error-500">*</span>
            </label>
            <DatePicker
              value={values.effectiveDate}
              onChangeDate={(date) => set("effectiveDate", date)}
              placeholder="dd/mm/yyyy"
              disabled={submitting}
            />
            {errors.effectiveDate && (
              <p className="text-theme-xs text-error-500 mt-1">
                {errors.effectiveDate}
              </p>
            )}
          </div>
        </div>

        {/* Row 5: Revision Type (Full Width) */}
        <div>
          <label className="block text-theme-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Revision Type <span className="text-error-500">*</span>
          </label>
          <Select
            value={revisionType}
            onChange={(e) => setRevisionType(e.target.value)}
            disabled={submitting}
            className="rounded-xl w-full"
          >
            {REVISION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </div>
      </FormSection>

      {/* ================= 2. COMPENSATION ADJUSTMENTS ================= */}
      <FormSection
        stepNumber="2"
        title="Compensation Adjustments"
        description="Configure compensation increment and revised CTC"
        icon={TrendingUp}
      >
        {/* Current CTC */}
        <div>
          <label className="block text-theme-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Current CTC (Annual) ₹
          </label>
          <Input
            type="number"
            placeholder="e.g. 1000000"
            value={currentCtc}
            onChange={(e) => handleCurrentCtcChange(e.target.value)}
            disabled={submitting}
            className="rounded-xl"
          />
          <p className="text-theme-xs text-gray-500 mt-1">
            Base compensation prior to revision
          </p>
        </div>

        {/* Revised CTC & Increment Row */}
        <div className="space-y-4">
          <div>
            <label className="block text-theme-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Revised CTC (Annual) ₹ <span className="text-error-500">*</span>
            </label>
            <Input
              type="number"
              placeholder="e.g. 1200000"
              value={revisedCtc}
              onChange={(e) => handleRevisedCtcChange(e.target.value)}
              disabled={submitting}
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-theme-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Increment %
              </label>
              <Input
                type="number"
                placeholder="e.g. 20"
                value={incrementPct}
                onChange={(e) => handleIncrementPctChange(e.target.value)}
                disabled={submitting}
                className="rounded-xl"
              />
            </div>

            <div>
              <label className="block text-theme-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Increment amount ₹
              </label>
              <Input
                type="number"
                placeholder="e.g. 200000"
                value={incrementAmt}
                onChange={(e) => handleIncrementAmtChange(e.target.value)}
                disabled={submitting}
                className="rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Revised Salary Basis Toggle & Amount Input */}
        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <label className="text-theme-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Revised Salary Calculation (INR)
            </label>
            <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => switchBasis("monthly")}
                className={`rounded-lg px-3.5 py-1 text-xs font-semibold transition-all ${
                  basis === "monthly"
                    ? "bg-brand-600 text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                }`}
              >
                Monthly Salary
              </button>
              <button
                type="button"
                onClick={() => switchBasis("annual")}
                className={`rounded-lg px-3.5 py-1 text-xs font-semibold transition-all ${
                  basis === "annual"
                    ? "bg-brand-600 text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                }`}
              >
                Annual Salary
              </button>
            </div>
          </div>

          <div>
            <label className="block text-theme-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              {basis === "monthly" ? "Monthly" : "Annual"} Salary Amount
            </label>
            <Input
              type="number"
              placeholder={basis === "monthly" ? "e.g. 15000" : "e.g. 180000"}
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              disabled={submitting}
              className="rounded-xl"
            />
          </div>
        </div>

        {/* CTC Summary Callout Card (Reference Image 3 in TexaOne Brand Theme) */}
        <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4 dark:border-sky-800 dark:bg-sky-950/40">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col sm:border-r sm:border-sky-200/80 sm:pr-3 dark:sm:border-sky-800/80">
              <span className="text-theme-xs font-medium text-slate-600 dark:text-slate-400">
                Net Monthly Salary:
              </span>
              <span className="text-theme-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {monthlyNet > 0 ? formatRupees(monthlyNet.toFixed(2)) : "—"}
              </span>
            </div>
            <div className="flex flex-col sm:border-r sm:border-sky-200/80 sm:pr-3 sm:pl-3 dark:sm:border-sky-800/80">
              <span className="text-theme-xs font-medium text-slate-600 dark:text-slate-400">
                Gross Monthly CTC:
              </span>
              <span className="text-theme-sm font-bold text-slate-900 dark:text-white mt-0.5">
                {monthlyNet > 0 ? formatRupees(monthlyNet.toFixed(2)) : "—"}
              </span>
            </div>
            <div className="flex flex-col sm:pl-3">
              <span className="text-theme-xs font-medium text-slate-600 dark:text-slate-400">
                Gross Annual CTC:
              </span>
              <span className="text-theme-base font-extrabold text-brand-700 dark:text-cyan-400 mt-0.5">
                {monthlyNet > 0
                  ? formatRupees((monthlyNet * 12).toFixed(2))
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Monthly Breakdown Inputs (Reference Image 4) */}
        <div className="pt-2">
          <label className="block text-theme-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2.5">
            REVISED MONTHLY SALARY COMPONENTS (INR)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-theme-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Basic (35%)
              </label>
              <Input
                type="number"
                placeholder="₹"
                value={values.basic}
                onChange={(e) => set("basic", e.target.value)}
                disabled={submitting}
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="block text-theme-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                DA (15%)
              </label>
              <Input
                type="number"
                placeholder="₹"
                value={values.da}
                onChange={(e) => set("da", e.target.value)}
                disabled={submitting}
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="block text-theme-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                HRA (30%)
              </label>
              <Input
                type="number"
                placeholder="₹"
                value={values.hra}
                onChange={(e) => set("hra", e.target.value)}
                disabled={submitting}
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="block text-theme-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                CA (20%)
              </label>
              <Input
                type="number"
                placeholder="₹"
                value={values.ca}
                onChange={(e) => set("ca", e.target.value)}
                disabled={submitting}
                className="rounded-xl"
              />
            </div>
          </div>
        </div>
      </FormSection>

      {/* ================= 3. REMARKS & SIGNATORY + UPLOADS ================= */}
      <FormSection
        stepNumber="3"
        title="Remarks & Signatory"
        description="Formal notes, authorized signature and company seal"
        icon={Building2}
      >
        <div>
          <label className="block text-theme-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Remarks
          </label>
          <Input
            placeholder="Enter remarks (optional)"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            disabled={submitting}
            className="rounded-xl"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-theme-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Signatory Name <span className="text-error-500">*</span>
            </label>
            <Input
              value={values.signatoryName}
              onChange={(e) => set("signatoryName", e.target.value)}
              disabled={submitting}
              className={`rounded-xl ${errors.signatoryName ? "border-error-500" : ""}`}
            />
            {errors.signatoryName && (
              <p className="text-theme-xs text-error-500 mt-1">
                {errors.signatoryName}
              </p>
            )}
          </div>

          <div>
            <label className="block text-theme-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Signatory Designation <span className="text-error-500">*</span>
            </label>
            <Input
              value={values.signatoryDesignation}
              onChange={(e) => set("signatoryDesignation", e.target.value)}
              disabled={submitting}
              className={`rounded-xl ${errors.signatoryDesignation ? "border-error-500" : ""}`}
            />
            {errors.signatoryDesignation && (
              <p className="text-theme-xs text-error-500 mt-1">
                {errors.signatoryDesignation}
              </p>
            )}
          </div>
        </div>

        {/* Signature & Company Seal Uploads (Reference Image 4) */}
        <div className="pt-4 border-t border-gray-200/90 dark:border-gray-800 space-y-3.5">
          <h4 className="text-theme-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
            <Stamp className="h-4 w-4 text-brand-500 dark:text-cyan-400" />
            SIGNATURE & COMPANY SEAL UPLOADS
          </h4>

          {/* Signatory Signature Image */}
          <div>
            <label className="block text-theme-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Signatory Signature Image
            </label>
            {signatureImageUrl ? (
              <div className="flex items-center gap-3 mt-1 p-2 border border-gray-200 rounded-xl bg-gray-50/80 dark:border-gray-700 dark:bg-gray-800/50">
                <img
                  src={signatureImageUrl}
                  alt="Signature Preview"
                  className="h-10 max-w-30 object-contain border bg-white p-1 rounded"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700 h-8 px-2"
                  onClick={() => onSignatureChange?.("")}
                >
                  <X className="h-4 w-4 mr-1" /> Clear
                </Button>
              </div>
            ) : (
              <div className="mt-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleImageUpload("signature", e.target.files?.[0] || null)
                  }
                  className="w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border file:border-brand-200 file:bg-brand-50/70 file:text-brand-700 file:text-xs file:font-semibold hover:file:bg-brand-100 cursor-pointer rounded-xl border border-gray-200 p-1.5 dark:border-gray-700 dark:file:bg-brand-950/40 dark:file:border-brand-800 dark:file:text-cyan-400"
                />
              </div>
            )}
          </div>

          {/* Company Seal / Stamp Image */}
          <div>
            <label className="block text-theme-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Company Seal / Stamp Image
            </label>
            {sealImageUrl ? (
              <div className="flex items-center gap-3 mt-1 p-2 border border-gray-200 rounded-xl bg-gray-50/80 dark:border-gray-700 dark:bg-gray-800/50">
                <img
                  src={sealImageUrl}
                  alt="Seal Preview"
                  className="h-10 max-w-25 object-contain border bg-white p-1 rounded"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700 h-8 px-2"
                  onClick={() => onSealChange?.("")}
                >
                  <X className="h-4 w-4 mr-1" /> Clear
                </Button>
              </div>
            ) : (
              <div className="mt-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleImageUpload("seal", e.target.files?.[0] || null)
                  }
                  className="w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border file:border-brand-200 file:bg-brand-50/70 file:text-brand-700 file:text-xs file:font-semibold hover:file:bg-brand-100 cursor-pointer rounded-xl border border-gray-200 p-1.5 dark:border-gray-700 dark:file:bg-brand-950/40 dark:file:border-brand-800 dark:file:text-cyan-400"
                />
              </div>
            )}
          </div>
        </div>
      </FormSection>

      {submitError ? (
        <p
          role="alert"
          className="text-theme-xs text-error-600 dark:text-error-400 bg-error-50 p-3 rounded-lg border border-error-200 dark:bg-error-950/40 dark:border-error-800"
        >
          {submitError}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-xl px-4 py-2"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          loading={submitting}
          className="rounded-xl px-5 py-2 font-bold shadow-md bg-brand-500 hover:bg-brand-600 text-white"
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
