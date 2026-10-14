"use client";

import { useEffect, useRef, useState } from "react";
import {
  Button,
  FormField,
  Input,
  Select,
  Textarea,
} from "@texawave-erp/ui-kit";
import {
  User,
  DollarSign,
  Calendar,
  Building2,
  TrendingUp,
  FileText,
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
  currentCtc?: number | string;
}

export interface RevisionFormExtra {
  currentCtc: string;
  revisedCtc: string;
  incrementPct: string;
  incrementAmt: string;
  revisionType: string;
  remarks: string;
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
    location: LEGACY_REVISION_DEFAULTS.location,
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

/** Revision letter form. Field names and limits follow CreateRevisionLetterDto. */
export function RevisionForm({
  employee,
  initial,
  onSubmit,
  onCancel,
  submitLabel,
  onValuesChange,
}: RevisionFormProps) {
  const [values, setValues] = useState<RevisionFormValues>(() => {
    if (initial) return revisionValuesFrom(initial);
    if (employee) return emptyRevisionValues(employee);
    throw new Error("RevisionForm needs an employee or an initial letter");
  });

  const [basis, setBasis] = useState<SalaryBasis>("monthly");
  const [amount, setAmount] = useState<string>(() =>
    initial ? round2(monthlyTotal(revisionValuesFrom(initial))) : "",
  );

  // Screen 4 specific fields
  const [revisionType, setRevisionType] = useState<string>("Annual Appraisal");
  const [currentCtc, setCurrentCtc] = useState<string>(() =>
    employee?.currentCtc ? String(employee.currentCtc) : "1000000",
  );
  const [revisedCtc, setRevisedCtc] = useState<string>("");
  const [incrementPct, setIncrementPct] = useState<string>("");
  const [incrementAmt, setIncrementAmt] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const employeeName = initial?.employeeName ?? employee?.name ?? "";
  const departmentName = employee?.department ?? "Engineering";
  const monthlyNet = monthlyTotal(values);

  // Synchronize live preview updates to parent via ref to prevent infinite loops
  const onValuesChangeRef = useRef(onValuesChange);
  useEffect(() => {
    onValuesChangeRef.current = onValuesChange;
  });

  useEffect(() => {
    onValuesChangeRef.current?.(values, {
      currentCtc,
      revisedCtc,
      incrementPct,
      incrementAmt,
      revisionType,
      remarks,
    });
  }, [
    values,
    currentCtc,
    revisedCtc,
    incrementPct,
    incrementAmt,
    revisionType,
    remarks,
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = revisionFormSchema.safeParse(values);
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

  const textField = (
    key: keyof RevisionFormValues,
    label: string,
    options: { required?: boolean; type?: string; placeholder?: string } = {},
  ) => (
    <FormField
      label={label}
      required={options.required ?? false}
      error={errors[key]}
    >
      {(fieldProps) => (
        <Input
          {...fieldProps}
          type={options.type ?? "text"}
          placeholder={options.placeholder}
          value={String(values[key] ?? "")}
          onChange={(e) => set(key, e.target.value as never)}
          disabled={submitting}
        />
      )}
    </FormField>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {/* 01 Revision Details */}
      <FormSection
        stepNumber="1"
        title="Revision Details"
        description="Enter the revision and employee details."
        icon={User}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-theme-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Employee <span className="text-error-500">*</span>
            </label>
            <div className="flex h-10 w-full items-center rounded-lg border border-gray-300 bg-gray-50 px-3 text-theme-sm font-semibold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
              {employeeName}
            </div>
          </div>

          <div>
            {textField("designation", "Designation", {
              required: true,
              placeholder: "e.g. Senior Software Engineer",
            })}
          </div>

          <div>
            <label className="block text-theme-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Department
            </label>
            <div className="flex h-10 w-full items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-theme-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {departmentName}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {textField("effectiveDate", "Effective date", {
            required: true,
            type: "date",
          })}
          <div>
            <label className="block text-theme-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Revision type <span className="text-error-500">*</span>
            </label>
            <Select
              value={revisionType}
              onChange={(e) => setRevisionType(e.target.value)}
              disabled={submitting}
            >
              {REVISION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </div>
          {textField("location", "Location", {
            required: true,
            placeholder: "e.g. Chennai",
          })}
        </div>
      </FormSection>

      {/* 02 Current & Revised Compensation (Screen 4) */}
      <FormSection
        stepNumber="2"
        title="Compensation Adjustments"
        description="Configure compensation increment and revised CTC"
        icon={TrendingUp}
      >
        <div className="grid grid-cols-1 gap-4">
          <FormField
            label="Current CTC (Annual) ₹"
            hint="Base compensation prior to revision"
          >
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="number"
                placeholder="e.g. 1000000"
                value={currentCtc}
                onChange={(e) => setCurrentCtc(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="Revised CTC (Annual) ₹" required>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="number"
                placeholder="e.g. 1200000"
                value={revisedCtc}
                onChange={(e) => handleRevisedCtcChange(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>

          <FormField label="Increment %">
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="number"
                placeholder="e.g. 20"
                value={incrementPct}
                onChange={(e) => handleIncrementPctChange(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>

          <FormField label="Increment amount ₹">
            {(fieldProps) => (
              <Input
                {...fieldProps}
                type="number"
                placeholder="e.g. 200000"
                value={incrementAmt}
                onChange={(e) => setIncrementAmt(e.target.value)}
                disabled={submitting}
              />
            )}
          </FormField>
        </div>

        {/* Component breakdown inputs */}
        <div className="mt-2 pt-3 border-t border-gray-100 dark:border-gray-800">
          <label className="block text-theme-xs font-semibold uppercase text-gray-500 mb-2">
            Monthly Breakdown (INR)
          </label>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {textField("basic", "Basic", { type: "number", placeholder: "₹" })}
            {textField("hra", "HRA", { type: "number", placeholder: "₹" })}
            {textField("ca", "CA", { type: "number", placeholder: "₹" })}
            {textField("da", "DA", { type: "number", placeholder: "₹" })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 rounded-xl border border-brand-200 bg-brand-50/60 p-4 text-theme-sm sm:grid-cols-2 dark:border-brand-800 dark:bg-brand-950/40">
          <div className="flex justify-between items-center pr-2">
            <span className="text-gray-600 dark:text-gray-300 font-medium">
              Revised Monthly Net:
            </span>
            <span className="font-bold text-gray-900 dark:text-white">
              {monthlyNet > 0 ? formatRupees(monthlyNet.toFixed(2)) : "—"}
            </span>
          </div>
          <div className="flex justify-between items-center pl-2 sm:border-l sm:border-brand-200 dark:sm:border-brand-800">
            <span className="text-gray-600 dark:text-gray-300 font-medium">
              Revised Annual CTC:
            </span>
            <span className="font-bold text-brand-700 dark:text-brand-400">
              {monthlyNet > 0
                ? formatRupees((monthlyNet * 12).toFixed(2))
                : "—"}
            </span>
          </div>
        </div>
      </FormSection>

      {/* 03 Remarks & Signatory */}
      <FormSection
        stepNumber="3"
        title="Remarks & Signatory"
        description="Formal notes and authorized signature"
        icon={Building2}
      >
        <FormField label="Remarks">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              placeholder="Enter remarks (optional)"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {textField("signatoryName", "Signatory name", { required: true })}
          {textField("signatoryDesignation", "Signatory designation", {
            required: true,
          })}
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
        >
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
