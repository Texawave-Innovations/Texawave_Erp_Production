"use client";

import { useEffect, useRef, useState } from "react";
import { Button, DatePicker, Input } from "@texawave-erp/ui-kit";
import {
  Clock,
  ShieldCheck,
  Stamp,
  X,
  FileText,
} from "lucide-react";
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
  todayDateOnly,
} from "../utils";

export interface OfferFormProps {
  /** Present when editing an existing offer. */
  initial?: OfferLetterView;
  onSubmit: (input: CreateOfferLetterInput) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  onValuesChange?: (values: OfferFormValues) => void;
  signatureImageUrl?: string;
  sealImageUrl?: string;
  onSignatureChange?: (url: string) => void;
  onSealChange?: (url: string) => void;
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

export function emptyOfferValues(): OfferFormValues {
  const offerDate = todayDateOnly();
  return {
    candidateName: "",
    role: "",
    location: LEGACY_OFFER_DEFAULTS.location,
    reportingManager: LEGACY_OFFER_DEFAULTS.reportingManager,
    offerDate: offerDate,
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

/**
 * Offer terms form matching Reference Layout:
 * - Candidate Information
 * - Working Schedule Timings
 * - Monthly Salary Components (with 35/15/30/20 auto-calc & green CTC summary)
 * - Signatory & Company Details
 * - Signature & Company Seal Uploads
 */
export function OfferForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
  onValuesChange,
  signatureImageUrl,
  sealImageUrl,
  onSignatureChange,
  onSealChange,
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

  // Inform parent of current values for live document preview
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

  function applyAmount(next: string, nextBasis: SalaryBasis) {
    setAmount(next);
    setValues((prev) => ({ ...prev, ...splitAmount(next, nextBasis) }));
  }

  function switchBasis(next: SalaryBasis) {
    if (next === basis) return;
    setBasis(next);
    applyAmount(convertAmount(amount, next), next);
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
      offerDate: toDateOnly(values.offerDate),
      joiningDate: toDateOnly(values.joiningDate),
      offerValidityDate: toDateOnly(values.offerValidityDate),
    };

    const result = offerFormSchema.safeParse(normalizedValues);
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 text-sm" noValidate>
      {/* ================= 1. CANDIDATE INFORMATION ================= */}
      <div className="space-y-3.5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          CANDIDATE INFORMATION
        </h4>

        {/* Candidate Name */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Candidate Name *
          </label>
          <Input
            placeholder="e.g. Arun Kumar R"
            value={values.candidateName}
            onChange={(e) => set("candidateName", e.target.value)}
            disabled={submitting}
            className={`w-full ${errors.candidateName ? "border-red-500 ring-1 ring-red-500" : ""}`}
          />
          {errors.candidateName && (
            <p className="text-[11px] text-red-500 mt-1">{errors.candidateName}</p>
          )}
        </div>

        {/* Role & Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Role / Designation *
            </label>
            <Input
              placeholder="e.g. Senior Software Eng"
              value={values.role}
              onChange={(e) => set("role", e.target.value)}
              disabled={submitting}
              className={`w-full ${errors.role ? "border-red-500 ring-1 ring-red-500" : ""}`}
            />
            {errors.role && (
              <p className="text-[11px] text-red-500 mt-1">{errors.role}</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Location *
            </label>
            <Input
              placeholder="Chennai"
              value={values.location}
              onChange={(e) => set("location", e.target.value)}
              disabled={submitting}
              className={`w-full ${errors.location ? "border-red-500 ring-1 ring-red-500" : ""}`}
            />
            {errors.location && (
              <p className="text-[11px] text-red-500 mt-1">{errors.location}</p>
            )}
          </div>
        </div>

        {/* Reporting Manager */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Reporting Manager
          </label>
          <Input
            placeholder="e.g. Mr. Nithyanandan Ramaraj"
            value={values.reportingManager}
            onChange={(e) => set("reportingManager", e.target.value)}
            disabled={submitting}
            className="w-full"
          />
        </div>

        {/* Dates row: Offer Date, Joining Date, Offer Validity with Calendar Picker */}
        <div className="relative focus-within:z-30 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="relative">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Offer Date
            </label>
            <DatePicker
              value={values.offerDate}
              onChangeDate={(date) => set("offerDate", date)}
              disabled={submitting}
              invalid={Boolean(errors.offerDate)}
              sizeVariant="sm"
              placeholder="dd/mm/yyyy"
              className="w-full text-xs"
            />
            {errors.offerDate && (
              <p className="text-[10px] text-red-500 mt-0.5">{errors.offerDate}</p>
            )}
          </div>
          <div className="relative">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Joining Date *
            </label>
            <DatePicker
              value={values.joiningDate}
              onChangeDate={(date) => set("joiningDate", date)}
              disabled={submitting}
              invalid={Boolean(errors.joiningDate)}
              sizeVariant="sm"
              placeholder="dd/mm/yyyy"
              className="w-full text-xs"
            />
            {errors.joiningDate && (
              <p className="text-[10px] text-red-500 mt-0.5">{errors.joiningDate}</p>
            )}
          </div>
          <div className="relative">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Offer Validity
            </label>
            <DatePicker
              value={values.offerValidityDate}
              onChangeDate={(date) => set("offerValidityDate", date)}
              disabled={submitting}
              invalid={Boolean(errors.offerValidityDate)}
              sizeVariant="sm"
              placeholder="dd/mm/yyyy"
              align="right"
              className="w-full text-xs"
            />
            {errors.offerValidityDate && (
              <p className="text-[10px] text-red-500 mt-0.5">{errors.offerValidityDate}</p>
            )}
          </div>
        </div>
      </div>

      {/* ================= 2. WORKING SCHEDULE TIMINGS ================= */}
      <div className="pt-4 border-t border-gray-200/90 dark:border-gray-800 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-brand-500 dark:text-sky-400" />
          WORKING SCHEDULE TIMINGS
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Mon – Fri
            </label>
            <Input
              value={values.workScheduleMonFri}
              onChange={(e) => set("workScheduleMonFri", e.target.value)}
              disabled={submitting}
              className="w-full text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Saturday
            </label>
            <Input
              value={values.workScheduleSat}
              onChange={(e) => set("workScheduleSat", e.target.value)}
              disabled={submitting}
              className="w-full text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Sunday
            </label>
            <Input
              value={values.workScheduleSun}
              onChange={(e) => set("workScheduleSun", e.target.value)}
              disabled={submitting}
              className="w-full text-xs"
            />
          </div>
        </div>
      </div>

      {/* ================= 3. MONTHLY SALARY COMPONENTS (INR) ================= */}
      <div className="pt-4 border-t border-gray-200/90 dark:border-gray-800 space-y-3.5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          MONTHLY SALARY COMPONENTS (INR)
        </h4>

        {/* 2 Big Toggle Buttons matching TexaOne brand theme */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => switchBasis("monthly")}
            disabled={submitting}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all duration-200 ${
              basis === "monthly"
                ? "bg-brand-500 hover:bg-brand-600 text-white shadow-xs shadow-brand-500/20"
                : "border border-gray-200 bg-white text-gray-700 hover:bg-brand-50/60 hover:text-brand-600 hover:border-brand-200 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300 dark:hover:bg-brand-950/40 dark:hover:text-cyan-400 dark:hover:border-cyan-800"
            }`}
          >
            Monthly Salary
          </button>
          <button
            type="button"
            onClick={() => switchBasis("annual")}
            disabled={submitting}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all duration-200 ${
              basis === "annual"
                ? "bg-brand-500 hover:bg-brand-600 text-white shadow-xs shadow-brand-500/20"
                : "border border-gray-200 bg-white text-gray-700 hover:bg-brand-50/60 hover:text-brand-600 hover:border-brand-200 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300 dark:hover:bg-brand-950/40 dark:hover:text-cyan-400 dark:hover:border-cyan-800"
            }`}
          >
            Annual Salary
          </button>
        </div>

        {/* Salary Amount Input */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {basis === "monthly" ? "Monthly Salary Amount" : "Annual Salary Amount"}
          </label>
          <Input
            type="number"
            min={0}
            placeholder={basis === "monthly" ? "e.g. 12000" : "e.g. 144000"}
            value={amount}
            onChange={(e) => applyAmount(e.target.value, basis)}
            disabled={submitting}
            className="w-full"
          />
        </div>

        {/* Brand Theme Highlight Summary Box */}
        <div className="rounded-xl border border-brand-100 bg-linear-to-br from-brand-50/80 via-sky-50/40 to-white p-3.5 space-y-1.5 text-xs text-slate-800 font-medium dark:border-brand-900/40 dark:from-brand-950/40 dark:via-sky-950/20 dark:to-gray-900 dark:text-slate-200">
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Net Monthly:</span>
            <span className="font-bold text-gray-900 dark:text-white">
              {monthlyNet > 0 ? `₹ ${Math.round(monthlyNet).toLocaleString("en-IN")}` : ""}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Gross Monthly CTC:</span>
            <span className="font-bold text-gray-900 dark:text-white">
              {monthlyNet > 0 ? `₹ ${Math.round(monthlyNet).toLocaleString("en-IN")}` : ""}
            </span>
          </div>
          <div className="flex justify-between items-center border-t border-brand-100 dark:border-brand-900/60 pt-1.5 text-sm font-extrabold text-brand-600 dark:text-cyan-400">
            <span>Gross Annual CTC:</span>
            <span>
              {annualGross > 0 ? `₹ ${Math.round(annualGross).toLocaleString("en-IN")}` : ""}
            </span>
          </div>
        </div>

        {/* 2x2 Components: Basic, DA, HRA, CA matching Image 2 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Basic (35%)
            </label>
            <Input
              type="number"
              value={values.basic}
              onChange={(e) => set("basic", e.target.value)}
              disabled={submitting}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              DA (15%)
            </label>
            <Input
              type="number"
              value={values.da}
              onChange={(e) => set("da", e.target.value)}
              disabled={submitting}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              HRA (30%)
            </label>
            <Input
              type="number"
              value={values.hra}
              onChange={(e) => set("hra", e.target.value)}
              disabled={submitting}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              CA (20%)
            </label>
            <Input
              type="number"
              value={values.ca}
              onChange={(e) => set("ca", e.target.value)}
              disabled={submitting}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* ================= 4. SIGNATORY & COMPANY DETAILS ================= */}
      <div className="pt-4 border-t border-gray-200/90 dark:border-gray-800 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-brand-500 dark:text-sky-400" />
          SIGNATORY & COMPANY DETAILS
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Signatory Name
            </label>
            <Input
              value={values.signatoryName}
              onChange={(e) => set("signatoryName", e.target.value)}
              disabled={submitting}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Signatory Designation
            </label>
            <Input
              value={values.signatoryDesignation}
              onChange={(e) => set("signatoryDesignation", e.target.value)}
              disabled={submitting}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* ================= 5. SIGNATURE & COMPANY SEAL UPLOADS ================= */}
      <div className="pt-4 border-t border-gray-200/90 dark:border-gray-800 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Stamp className="h-3.5 w-3.5 text-brand-500 dark:text-sky-400" />
          SIGNATURE & COMPANY SEAL UPLOADS
        </h4>

        {/* Signatory Signature Image */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
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
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
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

      {submitError ? (
        <p
          role="alert"
          className="text-theme-xs text-error-600 dark:text-error-400 bg-error-50 p-3 rounded-lg border border-error-200 dark:bg-error-950/40 dark:border-error-800"
        >
          {submitError}
        </p>
      ) : null}

      {/* Footer Buttons */}
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

/** Includes an optional text field only when it has content. */
function optional<K extends string>(key: K, value: string) {
  return value.trim() === "" ? {} : ({ [key]: value } as Record<K, string>);
}
