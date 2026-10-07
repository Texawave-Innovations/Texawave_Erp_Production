"use client";

import { Button, FormField, Input } from "@texawave-erp/ui-kit";
import { useState } from "react";
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
}

export interface RevisionFormProps {
  /** The employee the letter is issued to (create). */
  employee?: RevisionEmployee;
  /** The existing letter being edited. Its employee cannot change. */
  initial?: RevisionLetterView;
  onSubmit: (input: CreateRevisionLetterInput) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

/** Legacy defaults, mirrored from revision-letters.rules.ts REVISION_LETTER_DEFAULTS. */
const LEGACY_DEFAULTS = {
  location: "Chennai",
  signatoryName: "Amanullah Khan",
  signatoryDesignation: "Co-Founder",
} as const;

/** Legacy default effective date: the 1st of the month after today. */
function firstOfNextMonth(): string {
  const now = new Date();
  const first = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  return first.toISOString().slice(0, 10);
}

function valuesFrom(letter: RevisionLetterView): RevisionFormValues {
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

function emptyValues(employee: RevisionEmployee): RevisionFormValues {
  return {
    employeeId: employee.id,
    designation: employee.designation,
    location: LEGACY_DEFAULTS.location,
    letterDate: todayDateOnly(),
    effectiveDate: firstOfNextMonth(),
    basic: "",
    da: "",
    hra: "",
    ca: "",
    signatoryName: LEGACY_DEFAULTS.signatoryName,
    signatoryDesignation: LEGACY_DEFAULTS.signatoryDesignation,
  };
}

/** Revision letter form. Field names and limits follow CreateRevisionLetterDto. */
export function RevisionForm({
  employee,
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: RevisionFormProps) {
  const [values, setValues] = useState<RevisionFormValues>(() => {
    if (initial) return valuesFrom(initial);
    if (employee) return emptyValues(employee);
    throw new Error("RevisionForm needs an employee or an initial letter");
  });
  const [basis, setBasis] = useState<SalaryBasis>("monthly");
  const [amount, setAmount] = useState<string>(() =>
    initial ? round2(monthlyTotal(valuesFrom(initial))) : "",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const employeeName = initial?.employeeName ?? employee?.name ?? "";
  const monthlyNet = monthlyTotal(values);

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
    options: { required?: boolean; type?: string } = {},
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
          value={String(values[key] ?? "")}
          onChange={(e) => set(key, e.target.value as never)}
          disabled={submitting}
        />
      )}
    </FormField>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-theme-sm dark:border-gray-800 dark:bg-gray-800/50">
        <span className="text-gray-500 dark:text-gray-400">Employee: </span>
        <span className="font-medium text-gray-900 dark:text-white/90">
          {employeeName}
        </span>
        {initial ? (
          <span className="ml-2 text-theme-xs text-gray-500">
            {initial.documentNo}
          </span>
        ) : null}
      </div>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="sr-only">Letter terms</legend>
        {textField("designation", "Designation", { required: true })}
        {textField("location", "Location", { required: true })}
        {textField("letterDate", "Letter date", { type: "date" })}
        {textField("effectiveDate", "Effective date", {
          required: true,
          type: "date",
        })}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Monthly salary (INR)
        </legend>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div
            role="group"
            aria-label="Salary basis"
            className="inline-flex shrink-0 rounded-lg border border-gray-300 p-0.5"
          >
            {(["monthly", "annual"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={basis === option}
                onClick={() => switchBasis(option)}
                disabled={submitting}
                className={`rounded-md px-3 py-1.5 text-theme-xs font-medium transition-colors ${
                  basis === option
                    ? "bg-brand-500 text-gray-900"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-300"
                }`}
              >
                {option === "monthly" ? "Monthly" : "Annual"}
              </button>
            ))}
          </div>
          <div className="flex-1">
            <FormField
              label={basis === "monthly" ? "Monthly salary" : "Annual salary"}
              hint="Splits into Basic 35%, DA 15%, HRA 30%, CA 20%. Components can still be edited below."
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => applyAmount(e.target.value, basis)}
                  disabled={submitting}
                />
              )}
            </FormField>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {textField("basic", "Basic", { type: "number" })}
          {textField("da", "DA", { type: "number" })}
          {textField("hra", "HRA", { type: "number" })}
          {textField("ca", "CA", { type: "number" })}
        </div>

        <dl className="grid grid-cols-1 gap-2 rounded-lg border border-brand-200 bg-brand-25 p-4 text-theme-sm sm:grid-cols-2 dark:border-brand-800 dark:bg-brand-950/40">
          <div className="flex justify-between gap-2">
            <dt className="text-gray-600 dark:text-gray-300">Gross monthly</dt>
            <dd className="font-semibold">
              {monthlyNet > 0 ? formatRupees(monthlyNet.toFixed(2)) : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-gray-600 dark:text-gray-300">Gross annual</dt>
            <dd className="font-semibold">
              {monthlyNet > 0
                ? formatRupees((monthlyNet * 12).toFixed(2))
                : "—"}
            </dd>
          </div>
        </dl>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="sr-only">Signatory</legend>
        {textField("signatoryName", "Signatory name", { required: true })}
        {textField("signatoryDesignation", "Signatory designation", {
          required: true,
        })}
      </fieldset>

      {submitError ? (
        <p
          role="alert"
          className="text-theme-xs text-error-600 dark:text-error-400"
        >
          {submitError}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
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
