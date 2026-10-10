"use client";

import { useEffect, useRef, useState } from "react";
import { Button, FormField, Input, Select } from "@texawave-erp/ui-kit";
import {
  User,
  DollarSign,
  Calendar,
  Building2,
  Clock,
  CheckCircle,
} from "lucide-react";
import { FormSection } from "../../components/FormSection";
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
  onValuesChange?: (values: OfferFormValues) => void;
}

/** Legacy prefills, mirrored from offer-letters.rules.ts OFFER_LETTER_DEFAULTS. */
export const LEGACY_OFFER_DEFAULTS = {
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

export function emptyOfferValues(): OfferFormValues {
  const offerDate = todayDateOnly();
  return {
    candidateName: "",
    role: "",
    location: LEGACY_OFFER_DEFAULTS.location,
    reportingManager: LEGACY_OFFER_DEFAULTS.reportingManager,
    offerDate,
    joiningDate: "",
    offerValidityDate: addDaysToDateOnly(offerDate, 7),
    basic: "",
    da: "",
    hra: "",
    ca: "",
    workScheduleMonFri: LEGACY_OFFER_DEFAULTS.workScheduleMonFri,
    workScheduleSat: LEGACY_OFFER_DEFAULTS.workScheduleSat,
    workScheduleSun: LEGACY_OFFER_DEFAULTS.workScheduleSun,
    signatoryName: LEGACY_OFFER_DEFAULTS.signatoryName,
    signatoryDesignation: LEGACY_OFFER_DEFAULTS.signatoryDesignation,
    companyEmail: LEGACY_OFFER_DEFAULTS.companyEmail,
    companyPhone: LEGACY_OFFER_DEFAULTS.companyPhone,
    companyWebsite: LEGACY_OFFER_DEFAULTS.companyWebsite,
    companyAddress: LEGACY_OFFER_DEFAULTS.companyAddress,
  };
}

export function offerValuesFrom(offer: OfferLetterView): OfferFormValues {
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
  onValuesChange,
}: OfferFormProps) {
  const [values, setValues] = useState<OfferFormValues>(() =>
    initial ? offerValuesFrom(initial) : emptyOfferValues(),
  );
  const [basis, setBasis] = useState<SalaryBasis>("monthly");
  const [amount, setAmount] = useState<string>(() =>
    initial ? round2(monthlyTotal(offerValuesFrom(initial))) : "",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const monthlyNet = monthlyTotal(values);
  const annualGross = monthlyNet * 12;

  // Inform parent of current values for live document preview via ref to prevent infinite loops
  const onValuesChangeRef = useRef(onValuesChange);
  useEffect(() => {
    onValuesChangeRef.current = onValuesChange;
  });

  useEffect(() => {
    onValuesChangeRef.current?.(values);
  }, [values]);

  function set<K extends keyof OfferFormValues>(
    key: K,
    value: OfferFormValues[K],
  ) {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      return next;
    });
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
    options: {
      required?: boolean;
      hint?: string;
      type?: string;
      placeholder?: string;
    } = {},
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
          placeholder={options.placeholder}
          value={values[key]}
          onChange={(e) => set(key, e.target.value as never)}
          disabled={submitting}
        />
      )}
    </FormField>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {/* 01 Candidate Information */}
      <FormSection
        stepNumber="1"
        title="Candidate Information"
        description="Enter recipient and appointment details"
        icon={User}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {textField("candidateName", "Candidate name", {
            required: true,
            placeholder: "e.g. Rohit Gupta",
          })}
          {textField("role", "Designation", {
            required: true,
            placeholder: "e.g. Frontend Developer",
          })}
          {textField("location", "Location", {
            required: true,
            placeholder: "e.g. Chennai, India",
          })}
          {textField("reportingManager", "Reporting manager", {
            placeholder: "e.g. Mr. Nithyanandan Ramaraj",
          })}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {textField("offerDate", "Offer date", {
            required: true,
            type: "date",
          })}
          {textField("joiningDate", "Date of joining", {
            required: true,
            type: "date",
          })}
          {textField("offerValidityDate", "Offer valid until", {
            type: "date",
          })}
        </div>
      </FormSection>

      {/* 02 Compensation Details */}
      <FormSection
        stepNumber="2"
        title="Compensation Details"
        description="Configure structured salary breakdown"
        icon={DollarSign}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label className="block text-theme-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Pay type
            </label>
            <div
              role="group"
              aria-label="Salary basis"
              className="inline-flex rounded-lg border border-gray-300 p-0.5 dark:border-gray-700"
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
                      ? "bg-brand-500 text-gray-900 shadow-sm"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  {option === "monthly" ? "Monthly" : "Annual"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1">
            <FormField
              label={
                basis === "monthly"
                  ? "Total CTC (Monthly)"
                  : "Total CTC (Annual)"
              }
              hint="Splits into Basic 35%, DA 15%, HRA 30%, CA 20%. Specific items can be modified below."
            >
              {(fieldProps) => (
                <Input
                  {...fieldProps}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="e.g. 85000"
                  value={amount}
                  onChange={(e) => applyAmount(e.target.value, basis)}
                  disabled={submitting}
                />
              )}
            </FormField>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {textField("basic", "Basic salary", {
            type: "number",
            placeholder: "₹",
          })}
          {textField("hra", "HRA", { type: "number", placeholder: "₹" })}
          {textField("ca", "Conveyance", { type: "number", placeholder: "₹" })}
          {textField("da", "Other allowances (DA)", {
            type: "number",
            placeholder: "₹",
          })}
        </div>

        <div className="grid grid-cols-1 gap-2 rounded-xl border border-brand-200 bg-brand-50/60 p-4 text-theme-sm sm:grid-cols-2 dark:border-brand-800 dark:bg-brand-950/40">
          <div className="flex justify-between items-center pr-2">
            <span className="text-gray-600 dark:text-gray-300 font-medium">
              Monthly CTC:
            </span>
            <span className="font-bold text-gray-900 dark:text-white">
              {monthlyNet > 0 ? formatRupees(monthlyNet.toFixed(2)) : "—"}
            </span>
          </div>
          <div className="flex justify-between items-center pl-2 sm:border-l sm:border-brand-200 dark:sm:border-brand-800">
            <span className="text-gray-600 dark:text-gray-300 font-medium">
              Gross Annual CTC:
            </span>
            <span className="font-bold text-brand-700 dark:text-brand-400">
              {annualGross > 0 ? formatRupees(annualGross.toFixed(2)) : "—"}
            </span>
          </div>
        </div>
      </FormSection>

      {/* 03 Working Schedule */}
      <FormSection
        stepNumber="3"
        title="Working Schedule"
        description="Standard hours of duty and weekly off"
        icon={Clock}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {textField("workScheduleMonFri", "Mon – Fri")}
          {textField("workScheduleSat", "Saturday")}
          {textField("workScheduleSun", "Sunday")}
        </div>
      </FormSection>

      {/* 04 Signatory & Organization */}
      <FormSection
        stepNumber="4"
        title="Authorized Signatory & Organization"
        description="Authorized representative issuing this contract"
        icon={Building2}
      >
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

/** Includes an optional text field only when it has content. */
function optional<K extends string>(key: K, value: string) {
  return value.trim() === "" ? {} : ({ [key]: value } as Record<K, string>);
}
