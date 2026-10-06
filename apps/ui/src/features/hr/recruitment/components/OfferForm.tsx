"use client";

import { Button, FormField, Input } from "@texawave-erp/ui-kit";
import { useState } from "react";
import {
  issuesByField,
  offerFormSchema,
  toAmount,
  type OfferFormValues,
} from "../schema";
import {
  convertAmount,
  monthlyTotal,
  round2,
  splitAmount,
  withDefined,
  type SalaryBasis,
} from "../salary";
import type { CreateOfferLetterInput, OfferLetterView } from "../types";
import {
  addDaysToDateOnly,
  apiErrorMessage,
  formatRupees,
  todayDateOnly,
} from "../utils";

export interface OfferFormProps {
  /** Present when editing an existing offer. */
  initial?: OfferLetterView;
  onSubmit: (input: CreateOfferLetterInput) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

/** Legacy prefills, mirrored from offer-letters.rules.ts OFFER_LETTER_DEFAULTS. */
const LEGACY_DEFAULTS = {
  location: "Chennai",
  reportingManager: "Mr. Nithyanandan Ramaraj",
  workScheduleMonFri: "10:00 AM – 7:00 PM",
  workScheduleSat: "10:00 AM – 7:00 PM",
  workScheduleSun: "Week Off",
  signatoryName: "Amanullah Khan",
  signatoryDesignation: "Co-Founder",
  companyEmail: "contact@texawave.com",
  companyPhone: "+91 9361360821",
  companyWebsite: "www.texawave.com",
  companyAddress:
    "No. 93/206, Canal Bank Road, Indra Nagar, Adyar, Chennai – 600020",
} as const;

function emptyValues(): OfferFormValues {
  const offerDate = todayDateOnly();
  return {
    candidateName: "",
    role: "",
    location: LEGACY_DEFAULTS.location,
    reportingManager: LEGACY_DEFAULTS.reportingManager,
    offerDate,
    joiningDate: "",
    offerValidityDate: addDaysToDateOnly(offerDate, 7),
    basic: "",
    da: "",
    hra: "",
    ca: "",
    workScheduleMonFri: LEGACY_DEFAULTS.workScheduleMonFri,
    workScheduleSat: LEGACY_DEFAULTS.workScheduleSat,
    workScheduleSun: LEGACY_DEFAULTS.workScheduleSun,
    signatoryName: LEGACY_DEFAULTS.signatoryName,
    signatoryDesignation: LEGACY_DEFAULTS.signatoryDesignation,
    companyEmail: LEGACY_DEFAULTS.companyEmail,
    companyPhone: LEGACY_DEFAULTS.companyPhone,
    companyWebsite: LEGACY_DEFAULTS.companyWebsite,
    companyAddress: LEGACY_DEFAULTS.companyAddress,
  };
}

function valuesFrom(offer: OfferLetterView): OfferFormValues {
  return {
    candidateName: offer.candidateName,
    role: offer.role,
    location: offer.location,
    reportingManager: offer.reportingManager,
    offerDate: offer.offerDate,
    joiningDate: offer.joiningDate,
    offerValidityDate: offer.offerValidityDate,
    basic: offer.components.basic,
    da: offer.components.da,
    hra: offer.components.hra,
    ca: offer.components.ca,
    workScheduleMonFri: offer.workSchedule.monFri,
    workScheduleSat: offer.workSchedule.sat,
    workScheduleSun: offer.workSchedule.sun,
    signatoryName: offer.signatoryName,
    signatoryDesignation: offer.signatoryDesignation,
    companyEmail: offer.companyEmail,
    companyPhone: offer.companyPhone,
    companyWebsite: offer.companyWebsite,
    companyAddress: offer.companyAddress,
  };
}

/** Offer terms form. Field names and limits follow CreateOfferLetterDto. */
export function OfferForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: OfferFormProps) {
  const [values, setValues] = useState<OfferFormValues>(() =>
    initial ? valuesFrom(initial) : emptyValues(),
  );
  const [basis, setBasis] = useState<SalaryBasis>("monthly");
  const [amount, setAmount] = useState<string>(() =>
    initial ? round2(monthlyTotal(valuesFrom(initial))) : "",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const monthlyNet = monthlyTotal(values);
  const annualGross = monthlyNet * 12;

  function set<K extends keyof OfferFormValues>(
    key: K,
    value: OfferFormValues[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  /** Legacy behaviour: one amount drives all four components. */
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
    const result = offerFormSchema.safeParse(values);
    if (!result.success) {
      setErrors(issuesByField(result.error));
      return;
    }
    setErrors({});
    setSubmitError(null);
    setSubmitting(true);
    try {
      const v = result.data;
      const money = {
        ...withDefined("basic", toAmount(v.basic)),
        ...withDefined("da", toAmount(v.da)),
        ...withDefined("hra", toAmount(v.hra)),
        ...withDefined("ca", toAmount(v.ca)),
      };
      await onSubmit({
        candidateName: v.candidateName,
        role: v.role,
        location: v.location,
        ...optional("reportingManager", v.reportingManager),
        offerDate: v.offerDate,
        joiningDate: v.joiningDate,
        ...optional("offerValidityDate", v.offerValidityDate),
        ...money,
        workScheduleMonFri: v.workScheduleMonFri,
        workScheduleSat: v.workScheduleSat,
        workScheduleSun: v.workScheduleSun,
        signatoryName: v.signatoryName,
        signatoryDesignation: v.signatoryDesignation,
        companyEmail: v.companyEmail,
        companyPhone: v.companyPhone,
        companyWebsite: v.companyWebsite,
        companyAddress: v.companyAddress,
      });
    } catch (error) {
      setSubmitError(
        apiErrorMessage(error, "Could not save the offer letter. Try again."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const textField = (
    key: keyof OfferFormValues,
    label: string,
    options: { required?: boolean; hint?: string; type?: string } = {},
  ) => (
    <FormField
      label={label}
      required={options.required ?? false}
      error={errors[key]}
      hint={options.hint ?? ""}
    >
      {(fieldProps) => (
        <Input
          {...fieldProps}
          type={options.type ?? "text"}
          value={values[key]}
          onChange={(e) => set(key, e.target.value as never)}
          disabled={submitting}
        />
      )}
    </FormField>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Candidate
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {textField("candidateName", "Candidate name", { required: true })}
          {textField("role", "Role / designation", { required: true })}
          {textField("location", "Location", { required: true })}
          {textField("reportingManager", "Reporting manager")}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {textField("offerDate", "Offer date", {
            required: true,
            type: "date",
          })}
          {textField("joiningDate", "Joining date", {
            required: true,
            type: "date",
          })}
          {textField("offerValidityDate", "Offer valid until", {
            type: "date",
          })}
        </div>
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
            <dt className="text-gray-600 dark:text-gray-300">Net monthly</dt>
            <dd className="font-semibold">
              {monthlyNet > 0 ? formatRupees(monthlyNet.toFixed(2)) : "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-gray-600 dark:text-gray-300">
              Gross annual CTC
            </dt>
            <dd className="font-semibold">
              {annualGross > 0 ? formatRupees(annualGross.toFixed(2)) : "—"}
            </dd>
          </div>
        </dl>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Working schedule
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {textField("workScheduleMonFri", "Mon – Fri")}
          {textField("workScheduleSat", "Saturday")}
          {textField("workScheduleSun", "Sunday")}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-theme-xs font-semibold uppercase tracking-wide text-gray-500">
          Signatory and company
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {textField("signatoryName", "Signatory name", { required: true })}
          {textField("signatoryDesignation", "Signatory designation", {
            required: true,
          })}
          {textField("companyEmail", "Company e-mail", { required: true })}
          {textField("companyPhone", "Company phone", { required: true })}
          {textField("companyWebsite", "Company website", { required: true })}
        </div>
        {textField("companyAddress", "Company address", { required: true })}
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

/** Includes an optional text field only when it has content. */
function optional<K extends string>(key: K, value: string) {
  return value.trim() === "" ? {} : ({ [key]: value } as Record<K, string>);
}
