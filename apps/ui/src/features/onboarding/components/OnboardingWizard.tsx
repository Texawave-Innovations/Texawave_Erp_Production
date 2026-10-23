"use client";

import {
  addressSchema,
  bankDetailsSchema,
  governmentIdsSchema,
  personalDetailsSchema,
  ApiError,
} from "@texawave-erp/core";
import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  FormField,
  Input,
  Select,
} from "@texawave-erp/ui-kit";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  Building2,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  CreditCard,
  FileCheck,
  FileText,
  GraduationCap,
  HeartHandshake,
  Loader2,
  MapPin,
  Phone,
  ShieldCheck,
  Upload,
  User,
  Users,
} from "lucide-react";
import {
  clearPresentAddress,
  saveAddress,
  saveBank,
  saveGovernmentIds,
  savePersonal,
  submitOnboarding,
  uploadDocument,
} from "../api";
import { useMyDocuments, useMyEmployee } from "../hooks";
import { FamilyExperienceStep } from "./FamilyExperienceStep";

export const STEPS = [
  "Personal",
  "Address",
  "Bank & IDs",
  "Family & experience",
  "Documents",
  "Review & submit",
] as const;

export const STEP_ITEMS = [
  {
    title: "Personal Details",
    short: "Personal",
    icon: User,
    desc: "Demographics & emergency contacts",
  },
  {
    title: "Residential Address",
    short: "Address",
    icon: MapPin,
    desc: "Permanent & present residences",
  },
  {
    title: "Bank & Statutory IDs",
    short: "Bank & IDs",
    icon: CreditCard,
    desc: "Salary account & government IDs",
  },
  {
    title: "Family & Experience",
    short: "Family & Exp",
    icon: Users,
    desc: "Family background & past careers",
  },
  {
    title: "Document Verification",
    short: "Documents",
    icon: FileText,
    desc: "Identity & educational proofs",
  },
  {
    title: "Review & Sign-Off",
    short: "Review",
    icon: CheckCircle2,
    desc: "Final verification & submission",
  },
];

/** Friendly names for the server's "missing" keys (see onboarding-completeness.ts). */
export const MISSING_LABELS: Record<string, string> = {
  "personal.dateOfBirth": "Date of birth",
  "personal.gender": "Gender",
  "personal.emergencyContactName": "Emergency contact name",
  "personal.emergencyContactRelation": "Emergency contact relation",
  "personal.emergencyContactPhone": "Emergency contact phone",
  "personal.fatherName": "Father's name",
  "personal.fatherPhone": "Father's phone",
  "personal.motherName": "Mother's name",
  "personal.motherPhone": "Mother's phone",
  "permanentAddress.addressLine": "Permanent address line",
  "permanentAddress.district": "Permanent district",
  "permanentAddress.city": "Permanent city",
  "permanentAddress.state": "Permanent state",
  "permanentAddress.pincode": "Permanent pincode",
  "bank.accountHolderName": "Account holder name",
  "bank.accountNumberEncrypted": "Bank account number",
  "bank.ifsc": "IFSC code",
  "bank.bankName": "Bank name",
  "governmentIds.aadhaarNumber": "Aadhaar number",
  "governmentIds.panNumber": "PAN number",
};

/** Maps missing error key to wizard step index for 1-click navigation */
function getStepForMissingKey(key: string): number {
  if (key.startsWith("personal.")) return 0;
  if (key.startsWith("permanentAddress.") || key.startsWith("presentAddress."))
    return 1;
  if (key.startsWith("bank.") || key.startsWith("governmentIds.")) return 2;
  if (key.startsWith("family.") || key.startsWith("experience.")) return 3;
  if (key.startsWith("document.")) return 4;
  return 5;
}

type Errors = Record<string, string>;

/** Name-shaped fields: letters, spaces, and . ' - only — strip digits/symbols as typed. */
const NAME_FIELDS = new Set([
  "emergencyContactName",
  "emergencyContactRelation",
  "fatherName",
  "motherName",
  "accountHolderName",
  "bankName",
  "branchName",
  "areaLocality",
  "district",
  "city",
]);

/** 10-digit mobile fields — strip non-digits and cap length as typed. */
const PHONE_FIELDS = new Set([
  "emergencyContactPhone",
  "fatherPhone",
  "motherPhone",
]);

/** Fixed-length numeric-only fields — strip non-digits and cap length as typed. */
const DIGIT_FIELD_LENGTHS: Record<string, number> = {
  accountNumber: 18,
  aadhaarNumber: 12,
  esiNumber: 17,
  pfNumber: 12,
  pincode: 6,
};

function sanitizeForField(key: string, raw: string): string {
  if (NAME_FIELDS.has(key)) return raw.replace(/[^A-Za-z .'-]/g, "");
  if (PHONE_FIELDS.has(key)) return raw.replace(/\D/g, "").slice(0, 10);
  const digitMax = DIGIT_FIELD_LENGTHS[key];
  if (digitMax) return raw.replace(/\D/g, "").slice(0, digitMax);
  return raw;
}

const TODAY = new Date().toISOString().slice(0, 10);

function collectErrors(
  issues: { path: PropertyKey[]; message: string }[],
): Errors {
  const out: Errors = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in out)) out[key] = issue.message;
  }
  return out;
}

function apiMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Could not save. Check your connection and try again.";
}

const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

const MARITAL_OPTIONS = [
  { value: "SINGLE", label: "Single" },
  { value: "MARRIED", label: "Married" },
  { value: "DIVORCED", label: "Divorced" },
  { value: "WIDOWED", label: "Widowed" },
];

const BLOOD_GROUP_OPTIONS = [
  { value: "A+", label: "A+" },
  { value: "A-", label: "A-" },
  { value: "B+", label: "B+" },
  { value: "B-", label: "B-" },
  { value: "AB+", label: "AB+" },
  { value: "AB-", label: "AB-" },
  { value: "O+", label: "O+" },
  { value: "O-", label: "O-" },
];

export function OnboardingWizard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [missing, setMissing] = useState<string[] | null>(null);

  const me = useMyEmployee();
  const sentBackNote =
    me.data?.onboardingReviewStatus === "CHANGES_REQUESTED"
      ? (me.data.onboardingReviewNote ?? null)
      : null;

  // Values are held locally per step, so a failed save never clears what was typed.
  const [personal, setPersonal] = useState({
    dateOfBirth: "",
    gender: "",
    maritalStatus: "",
    bloodGroup: "",
    emergencyContactName: "",
    emergencyContactRelation: "",
    emergencyContactPhone: "",
    fatherName: "",
    fatherPhone: "",
    motherName: "",
    motherPhone: "",
  });
  const [permanent, setPermanent] = useState({
    addressLine: "",
    areaLocality: "",
    district: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [sameAsPermanent, setSameAsPermanent] = useState(true);
  const [present, setPresent] = useState({
    addressLine: "",
    areaLocality: "",
    district: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [bank, setBank] = useState({
    accountHolderName: "",
    accountNumber: "",
    ifsc: "",
    bankName: "",
    branchName: "",
  });
  const [ids, setIds] = useState({
    aadhaarNumber: "",
    panNumber: "",
    esiNumber: "",
    pfNumber: "",
  });

  async function run(action: () => Promise<unknown>, next: () => void) {
    setSaveError(null);
    setBusy(true);
    try {
      await action();
      next();
    } catch (error) {
      setSaveError(apiMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function savePersonalStep(event: React.FormEvent) {
    event.preventDefault();
    const parsed = personalDetailsSchema.safeParse({
      ...personal,
      maritalStatus: personal.maritalStatus || undefined,
      bloodGroup: personal.bloodGroup || undefined,
    });
    if (!parsed.success) return setErrors(collectErrors(parsed.error.issues));
    setErrors({});
    void run(
      () => savePersonal(parsed.data),
      () => setStep(1),
    );
  }

  function saveAddressStep(event: React.FormEvent) {
    event.preventDefault();
    const perm = addressSchema.safeParse(permanent);
    const pres = sameAsPermanent ? null : addressSchema.safeParse(present);
    if (!perm.success) return setErrors(collectErrors(perm.error.issues));
    if (pres && !pres.success)
      return setErrors(collectErrors(pres.error.issues));
    setErrors({});
    void run(
      async () => {
        await saveAddress("PERMANENT", perm.data);
        if (pres?.success) await saveAddress("PRESENT", pres.data);
        else await clearPresentAddress();
      },
      () => setStep(2),
    );
  }

  function saveBankStep(event: React.FormEvent) {
    event.preventDefault();
    const bankParsed = bankDetailsSchema.safeParse({
      ...bank,
      branchName: bank.branchName || undefined,
    });
    const idParsed = governmentIdsSchema.safeParse({
      ...ids,
      esiNumber: ids.esiNumber || undefined,
      pfNumber: ids.pfNumber || undefined,
    });
    const issues = [
      ...(bankParsed.success ? [] : bankParsed.error.issues),
      ...(idParsed.success ? [] : idParsed.error.issues),
    ];
    if (issues.length) return setErrors(collectErrors(issues));
    if (!bankParsed.success || !idParsed.success) return;
    setErrors({});
    void run(
      async () => {
        await saveBank(bankParsed.data);
        await saveGovernmentIds(idParsed.data);
      },
      () => setStep(3),
    );
  }

  async function submit() {
    setSaveError(null);
    setBusy(true);
    try {
      const result = await submitOnboarding();
      if (result.missing.length > 0) {
        setMissing(result.missing);
      } else {
        await queryClient.invalidateQueries();
        router.replace("/portal");
      }
    } catch (error) {
      setSaveError(apiMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const renderField = (
    label: string,
    key: string,
    value: string,
    onChange: (v: string) => void,
    placeholder?: string,
    required = true,
  ) => (
    <FormField label={label} required={required} error={errors[key]}>
      {(p) => (
        <Input
          {...p}
          type="text"
          value={value}
          placeholder={placeholder}
          disabled={busy}
          invalid={p.invalid}
          onChange={(e) => onChange(sanitizeForField(key, e.target.value))}
        />
      )}
    </FormField>
  );

  const currentStepItem = (STEP_ITEMS[step] ?? STEP_ITEMS[0])!;
  const StepIcon = currentStepItem.icon;
  const progressPercent = Math.round(((step + 1) / STEP_ITEMS.length) * 100);

  return (
    <div className="flex flex-col gap-6">
      {/* Executive Welcome & Progress Card */}
      <div className="overflow-visible rounded-2xl border border-sky-200/90 bg-white shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 p-6 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-cyan-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
                  Employee Onboarding Portal
                </span>
                <span className="text-xs font-semibold text-slate-400">·</span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Step {step + 1} of {STEP_ITEMS.length}
                </span>
              </div>
              <h1 className="mt-1.5 text-xl font-bold tracking-tight text-[#0a3271] sm:text-2xl dark:text-white">
                Complete Your Profile
              </h1>
              <p className="mt-0.5 text-xs text-[#2f6396] dark:text-sky-300/80">
                Each section is securely encrypted and saved as you progress.
              </p>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-auto">
              <div className="text-right">
                <p className="text-xs font-bold text-[#0a3271] dark:text-sky-200">
                  {progressPercent}% Completed
                </p>
                <p className="text-[10px] text-slate-400">
                  {STEP_ITEMS.length - (step + 1)} steps remaining
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-100 bg-sky-50 text-brand-600 font-bold text-xs dark:border-slate-800 dark:bg-slate-800 dark:text-cyan-400">
                {progressPercent}%
              </div>
            </div>
          </div>

          {/* Animated Gradient Progress Track */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-linear-to-r from-brand-600 via-sky-500 to-cyan-400 transition-all duration-300 ease-out shadow-xs"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Stepper Navigation Pills (Clickable for completed steps) */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 pt-1">
            {STEP_ITEMS.map((item, idx) => {
              const Icon = item.icon;
              const isCurrent = idx === step;
              const isPassed = idx < step;
              const isClickable = isPassed;

              return (
                <button
                  key={item.short}
                  type="button"
                  disabled={!isClickable && !isCurrent}
                  onClick={() => {
                    if (isClickable) {
                      setErrors({});
                      setSaveError(null);
                      setStep(idx);
                    }
                  }}
                  className={`flex items-center gap-2 rounded-xl p-2.5 text-left transition-all ${
                    isCurrent
                      ? "bg-linear-to-r from-brand-600 to-sky-500 text-white shadow-xs font-bold ring-2 ring-brand-500/20"
                      : isPassed
                        ? "border border-sky-200 bg-sky-50/70 text-brand-800 hover:bg-sky-100/80 hover:border-sky-300 dark:border-slate-700 dark:bg-slate-800/60 dark:text-cyan-300 cursor-pointer"
                        : "border border-slate-100 bg-slate-50/50 text-slate-400 dark:border-slate-800/80 dark:bg-slate-900/40 cursor-not-allowed opacity-75"
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      isCurrent
                        ? "bg-white/20 text-white"
                        : isPassed
                          ? "bg-brand-600 text-white"
                          : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {isPassed ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-xs font-bold leading-tight ${
                        isCurrent
                          ? "text-white"
                          : isPassed
                            ? "text-[#0a3271] dark:text-white"
                            : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {item.short}
                    </p>
                    <p
                      className={`truncate text-[10px] ${
                        isCurrent
                          ? "text-sky-100"
                          : isPassed
                            ? "text-brand-600 dark:text-cyan-400 font-medium"
                            : "text-slate-400"
                      }`}
                    >
                      {isPassed ? "Completed" : `Step 0${idx + 1}`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {sentBackNote && (
            <Alert
              variant="warning"
              title="HR requested updates to your details"
              className="mt-1"
            >
              <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                {sentBackNote}
              </p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                Please review and correct the marked items below, then submit
                again.
              </p>
            </Alert>
          )}
        </div>
      </div>

      {saveError && (
        <Alert variant="error" title="Could not save details">
          {saveError}
        </Alert>
      )}

      {/* Main Step Form Card */}
      <div className="overflow-visible rounded-2xl border border-sky-200/90 bg-white shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] dark:border-slate-800 dark:bg-slate-900">
        {/* Step Banner Header */}
        <div className="flex items-center justify-between border-b border-sky-200/90 bg-linear-to-r from-[#edf6ff] via-[#f0f8ff] to-[#e6f4fe] px-6 py-4 rounded-t-2xl dark:border-slate-800 dark:from-slate-800/90 dark:via-slate-850 dark:to-slate-900/60">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky-200/90 bg-white/95 p-1.5 shadow-[0_2px_10px_rgba(23,105,245,0.1)] text-brand-600 dark:border-gray-700/80 dark:bg-gray-800 dark:text-cyan-400 select-none">
              <StepIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight text-[#0a3271] dark:text-sky-100">
                  {currentStepItem.title}
                </h2>
                <span className="rounded-md bg-brand-100/80 px-2 py-0.5 text-[10px] font-bold text-brand-800 dark:bg-brand-950 dark:text-brand-300">
                  Step 0{step + 1}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] font-medium text-[#2f6396] dark:text-sky-300/80">
                {currentStepItem.desc}
              </p>
            </div>
          </div>
        </div>

        {/* Step Body Content */}
        <div className="p-6 sm:p-7">
          {/* STEP 0: PERSONAL */}
          {step === 0 && (
            <form
              onSubmit={savePersonalStep}
              noValidate
              className="flex flex-col gap-6"
            >
              {/* Basic Demographics */}
              <div className="rounded-xl border border-sky-200/80 bg-linear-to-b from-[#f8fbff]/60 to-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/30">
                <div className="flex items-center gap-2 pb-3 mb-4 border-b border-sky-100 dark:border-slate-800">
                  <User className="h-4 w-4 text-brand-600 dark:text-cyan-400" />
                  <h3 className="text-xs font-bold text-[#0a3271] uppercase tracking-wider dark:text-white">
                    Basic Demographics
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    label="Date of birth"
                    required
                    error={errors.dateOfBirth}
                  >
                    {(p) => (
                      <DatePicker
                        {...p}
                        minDate="1900-01-01"
                        maxDate={TODAY}
                        value={personal.dateOfBirth}
                        disabled={busy}
                        onChangeDate={(d) =>
                          setPersonal({ ...personal, dateOfBirth: d })
                        }
                      />
                    )}
                  </FormField>

                  <FormField label="Gender" required error={errors.gender}>
                    {(p) => (
                      <Select
                        {...p}
                        value={personal.gender}
                        disabled={busy}
                        onChange={(e) =>
                          setPersonal({ ...personal, gender: e.target.value })
                        }
                      >
                        <option value="">Select gender</option>
                        {GENDER_OPTIONS.map((g) => (
                          <option key={g.value} value={g.value}>
                            {g.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </FormField>

                  <FormField
                    label="Marital status"
                    error={errors.maritalStatus}
                  >
                    {(p) => (
                      <Select
                        {...p}
                        value={personal.maritalStatus}
                        disabled={busy}
                        onChange={(e) =>
                          setPersonal({
                            ...personal,
                            maritalStatus: e.target.value,
                          })
                        }
                      >
                        <option value="">
                          Select marital status (optional)
                        </option>
                        {MARITAL_OPTIONS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </FormField>

                  <FormField label="Blood group" error={errors.bloodGroup}>
                    {(p) => (
                      <Select
                        {...p}
                        value={personal.bloodGroup}
                        disabled={busy}
                        onChange={(e) =>
                          setPersonal({
                            ...personal,
                            bloodGroup: e.target.value,
                          })
                        }
                      >
                        <option value="">Select blood group (optional)</option>
                        {BLOOD_GROUP_OPTIONS.map((b) => (
                          <option key={b.value} value={b.value}>
                            {b.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </FormField>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="rounded-xl border border-sky-200/80 bg-linear-to-b from-[#f8fbff]/60 to-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/30">
                <div className="flex items-center gap-2 pb-3 mb-4 border-b border-sky-100 dark:border-slate-800">
                  <HeartHandshake className="h-4 w-4 text-brand-600 dark:text-cyan-400" />
                  <h3 className="text-xs font-bold text-[#0a3271] uppercase tracking-wider dark:text-white">
                    Emergency Contact Details
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {renderField(
                    "Contact person name",
                    "emergencyContactName",
                    personal.emergencyContactName,
                    (v) =>
                      setPersonal({ ...personal, emergencyContactName: v }),
                    "e.g. Ramesh Sharma",
                  )}
                  {renderField(
                    "Relationship",
                    "emergencyContactRelation",
                    personal.emergencyContactRelation,
                    (v) =>
                      setPersonal({ ...personal, emergencyContactRelation: v }),
                    "e.g. Brother, Spouse, Mother",
                  )}
                  {renderField(
                    "Emergency phone number",
                    "emergencyContactPhone",
                    personal.emergencyContactPhone,
                    (v) =>
                      setPersonal({ ...personal, emergencyContactPhone: v }),
                    "10 digits",
                  )}
                </div>
              </div>

              {/* Parents Information */}
              <div className="rounded-xl border border-sky-200/80 bg-linear-to-b from-[#f8fbff]/60 to-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/30">
                <div className="flex items-center gap-2 pb-3 mb-4 border-b border-sky-100 dark:border-slate-800">
                  <Users className="h-4 w-4 text-brand-600 dark:text-cyan-400" />
                  <h3 className="text-xs font-bold text-[#0a3271] uppercase tracking-wider dark:text-white">
                    Parents Information
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {renderField(
                    "Father's full name",
                    "fatherName",
                    personal.fatherName,
                    (v) => setPersonal({ ...personal, fatherName: v }),
                    "Father's name",
                  )}
                  {renderField(
                    "Father's contact phone",
                    "fatherPhone",
                    personal.fatherPhone,
                    (v) => setPersonal({ ...personal, fatherPhone: v }),
                    "10 digits",
                  )}
                  {renderField(
                    "Mother's full name",
                    "motherName",
                    personal.motherName,
                    (v) => setPersonal({ ...personal, motherName: v }),
                    "Mother's name",
                  )}
                  {renderField(
                    "Mother's contact phone",
                    "motherPhone",
                    personal.motherPhone,
                    (v) => setPersonal({ ...personal, motherPhone: v }),
                    "10 digits",
                  )}
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-end pt-3 border-t border-sky-100 dark:border-slate-800">
                <Button
                  type="submit"
                  variant="primary"
                  loading={busy}
                  disabled={busy}
                  className="flex items-center gap-2 px-6"
                >
                  <span>Save & Continue to Address</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          )}

          {/* STEP 1: ADDRESS */}
          {step === 1 && (
            <form
              onSubmit={saveAddressStep}
              noValidate
              className="flex flex-col gap-6"
            >
              {/* Permanent Address */}
              <div className="rounded-xl border border-sky-200/80 bg-linear-to-b from-[#f8fbff]/60 to-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/30">
                <div className="flex items-center gap-2 pb-3 mb-4 border-b border-sky-100 dark:border-slate-800">
                  <MapPin className="h-4 w-4 text-brand-600 dark:text-cyan-400" />
                  <h3 className="text-xs font-bold text-[#0a3271] uppercase tracking-wider dark:text-white">
                    Permanent Address
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    {renderField(
                      "Address line (House No, Building, Street)",
                      "addressLine",
                      permanent.addressLine,
                      (v) => setPermanent({ ...permanent, addressLine: v }),
                      "e.g. 14/B, Gandhi Street, Anna Nagar",
                    )}
                  </div>
                  {renderField(
                    "Area / Locality",
                    "areaLocality",
                    permanent.areaLocality,
                    (v) => setPermanent({ ...permanent, areaLocality: v }),
                    "e.g. Anna Nagar West",
                    false,
                  )}
                  {renderField(
                    "District",
                    "district",
                    permanent.district,
                    (v) => setPermanent({ ...permanent, district: v }),
                    "e.g. Chennai",
                  )}
                  {renderField(
                    "City",
                    "city",
                    permanent.city,
                    (v) => setPermanent({ ...permanent, city: v }),
                    "e.g. Chennai",
                  )}
                  {renderField(
                    "State",
                    "state",
                    permanent.state,
                    (v) => setPermanent({ ...permanent, state: v }),
                    "e.g. Tamil Nadu",
                  )}
                  {renderField(
                    "Pincode (6 digits)",
                    "pincode",
                    permanent.pincode,
                    (v) => setPermanent({ ...permanent, pincode: v }),
                    "600040",
                  )}
                </div>
              </div>

              {/* Same as permanent checkbox toggle */}
              <div className="flex items-center gap-3 rounded-xl border border-sky-200/80 bg-sky-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <Checkbox
                  id="same-address-check"
                  checked={sameAsPermanent}
                  disabled={busy}
                  onChange={(e) => setSameAsPermanent(e.target.checked)}
                />
                <label
                  htmlFor="same-address-check"
                  className="cursor-pointer select-none text-xs font-bold text-[#0a3271] dark:text-sky-200"
                >
                  Present communication address is the same as Permanent address
                </label>
              </div>

              {/* Present Address (if different) */}
              {!sameAsPermanent && (
                <div className="rounded-xl border border-sky-200/80 bg-linear-to-b from-[#f8fbff]/60 to-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/30">
                  <div className="flex items-center gap-2 pb-3 mb-4 border-b border-sky-100 dark:border-slate-800">
                    <MapPin className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                    <h3 className="text-xs font-bold text-[#0a3271] uppercase tracking-wider dark:text-white">
                      Present (Communication) Address
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      {renderField(
                        "Address line (House No, Building, Street)",
                        "addressLine",
                        present.addressLine,
                        (v) => setPresent({ ...present, addressLine: v }),
                        "e.g. Flat 302, Green Meadows",
                      )}
                    </div>
                    {renderField(
                      "Area / Locality",
                      "areaLocality",
                      present.areaLocality,
                      (v) => setPresent({ ...present, areaLocality: v }),
                      "e.g. HSR Layout Sector 2",
                      false,
                    )}
                    {renderField(
                      "District",
                      "district",
                      present.district,
                      (v) => setPresent({ ...present, district: v }),
                      "e.g. Bengaluru Urban",
                    )}
                    {renderField(
                      "City",
                      "city",
                      present.city,
                      (v) => setPresent({ ...present, city: v }),
                      "e.g. Bengaluru",
                    )}
                    {renderField(
                      "State",
                      "state",
                      present.state,
                      (v) => setPresent({ ...present, state: v }),
                      "e.g. Karnataka",
                    )}
                    {renderField(
                      "Pincode (6 digits)",
                      "pincode",
                      present.pincode,
                      (v) => setPresent({ ...present, pincode: v }),
                      "560102",
                    )}
                  </div>
                </div>
              )}

              {/* Action Bar */}
              <div className="flex items-center justify-between pt-3 border-t border-sky-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStep(0)}
                  disabled={busy}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Personal</span>
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={busy}
                  disabled={busy}
                  className="flex items-center gap-2 px-6"
                >
                  <span>Save & Continue to Bank & IDs</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          )}

          {/* STEP 2: BANK & IDS */}
          {step === 2 && (
            <form
              onSubmit={saveBankStep}
              noValidate
              className="flex flex-col gap-6"
            >
              {/* Salary Bank Details */}
              <div className="rounded-xl border border-sky-200/80 bg-linear-to-b from-[#f8fbff]/60 to-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/30">
                <div className="flex items-center gap-2 pb-3 mb-4 border-b border-sky-100 dark:border-slate-800">
                  <Building2 className="h-4 w-4 text-brand-600 dark:text-cyan-400" />
                  <h3 className="text-xs font-bold text-[#0a3271] uppercase tracking-wider dark:text-white">
                    Salary Bank Account Details
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    {renderField(
                      "Account holder's full name",
                      "accountHolderName",
                      bank.accountHolderName,
                      (v) => setBank({ ...bank, accountHolderName: v }),
                      "As per official bank passbook / statement",
                    )}
                  </div>
                  {renderField(
                    "Bank account number",
                    "accountNumber",
                    bank.accountNumber,
                    (v) => setBank({ ...bank, accountNumber: v }),
                    "Enter bank account number",
                  )}
                  {renderField(
                    "IFSC code",
                    "ifsc",
                    bank.ifsc,
                    (v) => setBank({ ...bank, ifsc: v.toUpperCase() }),
                    "e.g. HDFC0001234",
                  )}
                  {renderField(
                    "Bank name",
                    "bankName",
                    bank.bankName,
                    (v) => setBank({ ...bank, bankName: v }),
                    "e.g. HDFC Bank, SBI, ICICI",
                  )}
                  {renderField(
                    "Branch name",
                    "branchName",
                    bank.branchName,
                    (v) => setBank({ ...bank, branchName: v }),
                    "e.g. Anna Nagar Branch",
                    false,
                  )}
                </div>
              </div>

              {/* Government Statutory IDs */}
              <div className="rounded-xl border border-sky-200/80 bg-linear-to-b from-[#f8fbff]/60 to-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/30">
                <div className="flex items-center gap-2 pb-3 mb-4 border-b border-sky-100 dark:border-slate-800">
                  <ShieldCheck className="h-4 w-4 text-brand-600 dark:text-cyan-400" />
                  <h3 className="text-xs font-bold text-[#0a3271] uppercase tracking-wider dark:text-white">
                    Government Identification Numbers
                  </h3>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {renderField(
                    "Aadhaar number (12 digits)",
                    "aadhaarNumber",
                    ids.aadhaarNumber,
                    (v) => setIds({ ...ids, aadhaarNumber: v }),
                    "12 digit Aadhaar number",
                  )}
                  {renderField(
                    "PAN number (10 characters)",
                    "panNumber",
                    ids.panNumber,
                    (v) => setIds({ ...ids, panNumber: v.toUpperCase() }),
                    "e.g. ABCDE1234F",
                  )}
                  {renderField(
                    "ESI number (optional)",
                    "esiNumber",
                    ids.esiNumber,
                    (v) => setIds({ ...ids, esiNumber: v }),
                    "17 digits if previously enrolled",
                    false,
                  )}
                  {renderField(
                    "PF (UAN) number (optional)",
                    "pfNumber",
                    ids.pfNumber,
                    (v) => setIds({ ...ids, pfNumber: v }),
                    "12 digits if previously enrolled",
                    false,
                  )}
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between pt-3 border-t border-sky-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStep(1)}
                  disabled={busy}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Address</span>
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={busy}
                  disabled={busy}
                  className="flex items-center gap-2 px-6"
                >
                  <span>Save & Continue to Family & Experience</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          )}

          {/* STEP 3: FAMILY & EXPERIENCE */}
          {step === 3 && (
            <FamilyExperienceStep
              onBack={() => setStep(2)}
              onContinue={() => setStep(4)}
            />
          )}

          {/* STEP 4: DOCUMENTS */}
          {step === 4 && (
            <DocumentsStep
              onBack={() => setStep(3)}
              onContinue={() => setStep(5)}
            />
          )}

          {/* STEP 5: REVIEW & SUBMIT */}
          {step === 5 && (
            <div className="flex flex-col gap-6">
              {/* Review Overview Banner */}
              <div className="rounded-xl border border-sky-200/80 bg-linear-to-b from-[#f8fbff]/60 to-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/30">
                <div className="flex items-center gap-2 pb-3 mb-4 border-b border-sky-100 dark:border-slate-800">
                  <CheckCircle2 className="h-4 w-4 text-brand-600 dark:text-cyan-400" />
                  <h3 className="text-xs font-bold text-[#0a3271] uppercase tracking-wider dark:text-white">
                    Profile Verification & Final Submission
                  </h3>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Please confirm that all your details and uploaded documents
                  are accurate. Once submitted, HR will review your submission
                  and activate your full employee self-service portal.
                </p>

                {/* Section Quick Summary Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                  {[
                    { title: "Personal Details", stepIdx: 0, icon: User },
                    { title: "Residential Address", stepIdx: 1, icon: MapPin },
                    {
                      title: "Bank & Statutory IDs",
                      stepIdx: 2,
                      icon: CreditCard,
                    },
                    { title: "Family & Experience", stepIdx: 3, icon: Users },
                    { title: "Document Uploads", stepIdx: 4, icon: FileText },
                  ].map((sec) => {
                    const Icon = sec.icon;
                    return (
                      <div
                        key={sec.title}
                        className="flex items-center justify-between rounded-xl border border-sky-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-brand-600 dark:bg-slate-800 dark:text-cyan-400">
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="text-xs font-bold text-[#0a3271] dark:text-white">
                            {sec.title}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setStep(sec.stepIdx)}
                          className="text-[11px] font-bold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                        >
                          Edit
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Missing Fields Warning if any */}
              {missing && missing.length > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <div className="flex items-center gap-2 pb-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>Incomplete Mandatory Fields</span>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
                    The server reported missing information required before
                    submission. Click on any item below to jump directly to that
                    section:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {missing.map((key) => {
                      const targetStep = getStepForMissingKey(key);
                      const label =
                        MISSING_LABELS[key] ??
                        key.replace(/^document\./, "Document: ");
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setStep(targetStep)}
                          className="flex items-center justify-between rounded-lg border border-amber-200/80 bg-white/80 px-3 py-2 text-left text-xs font-medium text-amber-900 hover:border-brand-300 hover:bg-white shadow-2xs transition-all dark:border-amber-800 dark:bg-slate-900 dark:text-amber-200 cursor-pointer"
                        >
                          <span className="truncate">{label}</span>
                          <span className="shrink-0 text-[10px] font-bold text-brand-600 ml-2">
                            Fix in Step {targetStep + 1} →
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      All Mandatory Sections Completed
                    </p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      Ready to submit your profile for HR verification and
                      activation.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Bar */}
              <div className="flex items-center justify-between pt-3 border-t border-sky-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStep(4)}
                  disabled={busy}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Documents</span>
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => void submit()}
                  loading={busy}
                  disabled={busy}
                  className="flex items-center gap-2 px-8 py-2.5 font-bold shadow-md"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Submit Profile to HR</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

interface DocumentRowConfig {
  type: string;
  label: string;
  required: boolean;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const DOCUMENT_CONFIGS: DocumentRowConfig[] = [
  {
    type: "PROFILE_PHOTO",
    label: "Official Profile Photo",
    required: true,
    icon: Camera,
    description: "Clear passport-style headshot (PNG, JPG, or WebP up to 5MB)",
  },
  {
    type: "AADHAAR",
    label: "Aadhaar Card",
    required: true,
    icon: ShieldCheck,
    description: "Front & back copy in PDF or image format",
  },
  {
    type: "PAN",
    label: "PAN Card",
    required: true,
    icon: CreditCard,
    description: "Legible copy showing PAN number and signature",
  },
  {
    type: "BANK_STATEMENT",
    label: "Bank Passbook / Cancelled Cheque",
    required: true,
    icon: Building2,
    description: "Showing account number, account holder name, and IFSC code",
  },
  {
    type: "CERT_10TH",
    label: "10th Standard Certificate",
    required: true,
    icon: Award,
    description: "Marksheet or passing certificate",
  },
  {
    type: "CERT_12TH",
    label: "12th Standard / Diploma Certificate",
    required: true,
    icon: Award,
    description: "Higher secondary certificate or diploma marksheet",
  },
  {
    type: "CERT_GRADUATION",
    label: "Graduation Degree Certificate",
    required: true,
    icon: GraduationCap,
    description: "Degree certificate or consolidated marksheet",
  },
  {
    type: "RESUME",
    label: "Updated Resume (PDF)",
    required: false,
    icon: FileText,
    description: "Latest curriculum vitae in PDF format",
  },
  {
    type: "CERT_POST_GRADUATION",
    label: "Post-Graduation Certificate",
    required: false,
    icon: GraduationCap,
    description: "Master's degree or PG diploma certificate if applicable",
  },
];

function DocumentsStep({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: () => void;
}) {
  const documents = useMyDocuments();
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const uploadedTypes = new Set(
    (documents.data ?? []).map((d) => d.documentType),
  );
  const uploadedName = (type: string) =>
    (documents.data ?? []).find((d) => d.documentType === type)?.fileName;

  async function onPick(type: string, file: File | undefined) {
    if (!file) return;
    setRowError((prev) => ({ ...prev, [type]: "" }));
    if (file.size > MAX_UPLOAD_BYTES) {
      setRowError((prev) => ({
        ...prev,
        [type]: "File must be 5 MB or smaller.",
      }));
      return;
    }
    setUploading(type);
    try {
      await uploadDocument(type, file);
      await documents.refetch();
    } catch (error) {
      setRowError((prev) => ({ ...prev, [type]: apiMessage(error) }));
    } finally {
      setUploading(null);
    }
  }

  const uploadedCount = (documents.data ?? []).length;
  const requiredCount = DOCUMENT_CONFIGS.filter((d) => d.required).length;
  const uploadedRequiredCount = DOCUMENT_CONFIGS.filter(
    (d) => d.required && uploadedTypes.has(d.type),
  ).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Upload Instructions Header */}
      <div className="flex items-center justify-between rounded-xl border border-sky-100 bg-sky-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/40">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-2xs">
            <Upload className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-[#0a3271] dark:text-sky-200">
              Document Requirements
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Accepted formats: PDF, JPG, JPEG, or PNG up to 5 MB per file.
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-800 dark:bg-brand-950 dark:text-brand-300">
            {uploadedRequiredCount} of {requiredCount} Required Uploaded
          </span>
        </div>
      </div>

      {/* Document Upload Rows */}
      <div className="flex flex-col gap-3">
        {DOCUMENT_CONFIGS.map((row) => {
          const Icon = row.icon;
          const isUploaded = uploadedTypes.has(row.type);
          const fileName = uploadedName(row.type);
          const isRowBusy = uploading === row.type;

          return (
            <div
              key={row.type}
              className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border p-4 transition-all ${
                isUploaded
                  ? "border-emerald-200/90 bg-emerald-50/20 dark:border-emerald-900/40 dark:bg-emerald-950/10"
                  : row.required
                    ? "border-sky-200/80 bg-white hover:border-sky-300 dark:border-slate-800 dark:bg-slate-900/40"
                    : "border-slate-200/70 bg-white dark:border-slate-800 dark:bg-slate-900/20"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                    isUploaded
                      ? "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "border-sky-100 bg-sky-50 text-brand-600 dark:border-slate-800 dark:bg-slate-800 dark:text-cyan-400"
                  }`}
                >
                  {isUploaded ? (
                    <FileCheck className="h-5 w-5" />
                  ) : (
                    <Icon className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-[#0a3271] dark:text-white">
                      {row.label}
                    </h4>
                    {row.required ? (
                      <span className="rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                        Required
                      </span>
                    ) : (
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        Optional
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {row.description}
                  </p>

                  {/* Status Note */}
                  {isUploaded && fileName && (
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5" />
                      <span className="truncate max-w-xs">{fileName}</span>
                    </div>
                  )}

                  {rowError[row.type] && (
                    <p
                      role="alert"
                      className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-400"
                    >
                      {rowError[row.type]}
                    </p>
                  )}
                </div>
              </div>

              {/* Upload Action */}
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <input
                  ref={(el) => {
                    fileInputRefs.current[row.type] = el;
                  }}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  disabled={uploading !== null}
                  className="hidden"
                  onChange={(e) => {
                    void onPick(row.type, e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant={isUploaded ? "secondary" : "primary"}
                  size="sm"
                  disabled={uploading !== null}
                  loading={isRowBusy}
                  onClick={() => fileInputRefs.current[row.type]?.click()}
                  className="flex items-center gap-1.5"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>{isUploaded ? "Replace File" : "Upload Document"}</span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Bar */}
      <div className="flex items-center justify-between pt-3 border-t border-sky-100 dark:border-slate-800">
        <Button
          type="button"
          variant="secondary"
          onClick={onBack}
          disabled={uploading !== null}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Family & Experience</span>
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={onContinue}
          disabled={uploading !== null}
          className="flex items-center gap-2 px-6"
        >
          <span>Continue to Final Review</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
