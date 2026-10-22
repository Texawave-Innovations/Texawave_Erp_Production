"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Building2,
  KeyRound,
  ArrowLeft,
  Copy,
  Check,
  UserPlus,
  ShieldCheck,
} from "lucide-react";
import {
  ApiError,
  newHireSchema,
  type NewHireFormValues,
} from "@texawave-erp/core";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  ErrorState,
  FormField,
  Input,
  PasswordField,
  Select,
  Skeleton,
  Semantic3DIcon,
} from "@texawave-erp/ui-kit";
import {
  createNewHire,
  PartialNewHireError,
  type CreatedEmployee,
} from "../api";
import {
  useDepartmentOptions,
  useDesignationOptions,
  useEmploymentTypeOptions,
  useRoleOptions,
  useTeamOptions,
} from "../hooks";
import { FormSection } from "@/features/hr/components";

type FieldKey = keyof NewHireFormValues;

const sanitizeName = (raw: string) => raw.replace(/[^A-Za-z .'-]/g, "");
const sanitizeMobile = (raw: string) => raw.replace(/\D/g, "").slice(0, 10);
const generateSecurePassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
  let pwd = "";
  for (let i = 0; i < 14; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
};

interface FormState {
  firstName: string;
  lastName: string;
  mobile: string;
  email: string;
  roleId: string;
  departmentId: string;
  teamId: string;
  designationId: string;
  employmentTypeId: string;
  dateOfJoining: string;
  tempPassword: string;
}

const EMPTY: FormState = {
  firstName: "",
  lastName: "",
  mobile: "",
  email: "",
  roleId: "",
  departmentId: "",
  teamId: "",
  designationId: "",
  employmentTypeId: "",
  dateOfJoining: "",
  tempPassword: "",
};

interface Created {
  employee: CreatedEmployee;
  email: string;
  tempPassword: string;
}

/**
 * Enhanced New Hire Creation View.
 * Organizes fields into 3 structured sections (Personal, Organization, Account),
 * provides live interactive password requirement feedback, and maintains complete
 * validation & API error handling.
 */
export function NewHireView() {
  const router = useRouter();
  const [values, setValues] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [partialUserId, setPartialUserId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);

  const teams = useTeamOptions();
  const designations = useDesignationOptions();
  const employmentTypes = useEmploymentTypeOptions();
  const departments = useDepartmentOptions();
  const roles = useRoleOptions();
  const lists = [teams, designations, employmentTypes, departments, roles];
  const listsLoading = lists.some((q) => q.isPending);
  const listFailed = lists.some((q) => q.isError);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Clear field-specific error as user types
    if (errors[key as FieldKey]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key as FieldKey];
        return next;
      });
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);
    setPartialUserId(null);

    const result = newHireSchema.safeParse({
      firstName: values.firstName,
      lastName: values.lastName,
      mobile: values.mobile,
      email: values.email,
      roleId: values.roleId ? Number(values.roleId) : undefined,
      departmentId: Number(values.departmentId),
      teamId: Number(values.teamId),
      designationId: Number(values.designationId),
      employmentTypeId: Number(values.employmentTypeId),
      dateOfJoining: values.dateOfJoining,
      tempPassword: values.tempPassword,
    });

    if (!result.success) {
      const fieldErrors: Partial<Record<FieldKey, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !(key in fieldErrors)) {
          fieldErrors[key as FieldKey] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    const employeeRole = roles.data?.find((r) => r.name === "Employee");
    if (!employeeRole) {
      setSubmitError(
        "The 'Employee' role is missing from Settings → Roles. Every new hire needs it for self-service onboarding — ask an administrator to restore it before creating new hires.",
      );
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const employee = await createNewHire(result.data, employeeRole.id);
      setCreated({
        employee,
        email: result.data.email,
        tempPassword: result.data.tempPassword,
      });
      setValues(EMPTY);
    } catch (error) {
      if (error instanceof PartialNewHireError) {
        setPartialUserId(error.userId);
        setSubmitError(error.message);
      } else if (error instanceof ApiError && error.isPermissionError) {
        setSubmitError(
          "You don't have permission to create employees. Ask an administrator for access.",
        );
      } else if (error instanceof ApiError && error.statusCode === 409) {
        setSubmitError("An account with this email already exists.");
      } else {
        setSubmitError(
          "Could not create the new hire. Check the fields and try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function copyPassword(password: string) {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  // Success Screen
  if (created) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 pb-12 animate-reveal">
        <div className="overflow-hidden rounded-2xl border border-sky-200/90 bg-white shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] dark:border-slate-700 dark:bg-gray-900">
          {/* Prime Blue Light-Contrast Header */}
          <div className="flex items-center gap-3.5 border-b border-sky-200/90 bg-linear-to-r from-[#edf6ff] via-[#f0f8ff] to-[#e6f4fe] px-6 py-4.5 dark:border-slate-700/80 dark:from-slate-800/90 dark:via-slate-850 dark:to-slate-900/60">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-200/90 bg-white/95 p-1.5 shadow-[0_2px_10px_rgba(23,105,245,0.1)] dark:border-gray-700/80 dark:bg-gray-800 select-none">
              <Semantic3DIcon name="check" size={32} />
            </div>
            <div>
              <h1 className="text-title-sm font-bold tracking-tight text-[#0a3271] dark:text-sky-100">
                New Hire Created
              </h1>
              <p className="mt-0.5 text-[11px] font-medium text-[#2f6396] dark:text-sky-300/80">
                {created.employee.fullName} ({created.employee.employeeCode}) can now sign in.
              </p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <Alert variant="warning" title="Share this temporary password once">
              It is shown only here. The employee must change it on their first
              sign-in.
            </Alert>

            <div className="rounded-xl border border-sky-200 bg-[#edf6ff]/40 p-4 dark:border-slate-700 dark:bg-slate-800/40 space-y-3">
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
                  Sign-in email
                </span>
                <p className="mt-0.5 font-bold text-theme-sm text-[#0a3271] dark:text-white">
                  {created.email}
                </p>
              </div>

              <div className="border-t border-sky-200 pt-3 dark:border-slate-700">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#2f6396] dark:text-sky-300">
                  Temporary password
                </span>
                <p className="mt-0.5 font-bold text-theme-base text-[#0a3271] dark:text-white tracking-wider">
                  {created.tempPassword}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => copyPassword(created.tempPassword)}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-success-600" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy password</span>
                  </>
                )}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setCreated(null);
                  setCopied(false);
                }}
                className="gap-2"
              >
                <UserPlus className="h-4 w-4" />
                <span>Add another hire</span>
              </Button>
              <Button
                variant="ghost"
                onClick={() => router.push("/hr/employees")}
              >
                Back to employees
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Lookup Options Error
  if (listFailed) {
    return (
      <div className="mx-auto max-w-3xl pb-12">
        <ErrorState
          title="Could not load the form options"
          description="Teams, departments, designations, employment types, or roles failed to load."
          onRetry={() => lists.forEach((q) => void q.refetch())}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12 animate-reveal">
      {/* Executive Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-sky-200/90 bg-linear-to-r from-[#edf6ff] via-[#f0f8ff] to-[#e6f4fe] p-6 shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] dark:border-slate-700/80 dark:from-slate-800/90 dark:via-slate-850 dark:to-slate-900/60">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Link
              href="/hr/employees"
              className="group inline-flex items-center gap-1.5 text-[12px] font-bold text-brand-500 hover:text-[#0a3271] dark:text-sky-400 dark:hover:text-sky-200 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>Back to employees</span>
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-title-sm font-bold tracking-tight text-[#0a3271] dark:text-white">
                New Hire
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200/90 bg-white/80 px-3 py-0.5 text-[11px] font-bold text-brand-500 shadow-xs dark:border-sky-800/60 dark:bg-slate-800 dark:text-sky-300">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
                Provisioning Wizard
              </span>
            </div>

            <p className="max-w-2xl text-[12px] font-medium text-[#2f6396] dark:text-sky-300/80">
              Creates the employee master record, organizational assignment, and temporary sign-in credentials.
            </p>
          </div>

          <div className="hidden sm:flex sm:items-center sm:gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-sky-200/90 bg-white/95 p-2 shadow-[0_8px_20px_rgba(23,105,245,0.12)] ring-4 ring-white/70 dark:border-slate-700 dark:bg-slate-800 dark:ring-slate-800/60">
              <Semantic3DIcon name="recruitment" size={42} alt="New hire onboarding" />
            </div>
          </div>
        </div>

        {/* 3-Step Wizard Roadmap */}
        <div className="mt-5 pt-4 border-t border-sky-200/90 dark:border-slate-700 flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] font-semibold text-[#2f6396] dark:text-sky-300/70">
          <span className="inline-flex items-center gap-2 rounded-xl border border-sky-200/90 bg-white/85 px-2.5 py-1 text-[#0a3271] shadow-2xs dark:border-slate-700 dark:bg-slate-800/80 dark:text-sky-200">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white text-[10px] font-black shadow-xs">1</span>
            Personal Info
          </span>
          <span className="text-sky-300 dark:text-slate-600 font-bold">→</span>
          <span className="inline-flex items-center gap-2 rounded-xl border border-sky-200/90 bg-white/85 px-2.5 py-1 text-[#0a3271] shadow-2xs dark:border-slate-700 dark:bg-slate-800/80 dark:text-sky-200">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white text-[10px] font-black shadow-xs">2</span>
            Organization & Roles
          </span>
          <span className="text-sky-300 dark:text-slate-600 font-bold">→</span>
          <span className="inline-flex items-center gap-2 rounded-xl border border-sky-200/90 bg-white/85 px-2.5 py-1 text-[#0a3271] shadow-2xs dark:border-slate-700 dark:bg-slate-800/80 dark:text-sky-200">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white text-[10px] font-black shadow-xs">3</span>
            Security & Access
          </span>
        </div>
      </div>

      {listsLoading ? (
        <Card className="rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {submitError && (
            <Alert variant="error" title="Could not create the new hire">
              {submitError}
              {partialUserId !== null && (
                <span className="block mt-1">
                  The sign-in (user #{partialUserId}) was created. Remove it
                  from{" "}
                  <Link
                    href="/admin/users"
                    className="underline font-semibold hover:opacity-80"
                  >
                    Users
                  </Link>{" "}
                  before retrying, so the email is free again.
                </span>
              )}
            </Alert>
          )}

          {/* Section 01: Personal Information */}
          <FormSection
            stepNumber="01"
            title="Personal Information"
            description="Basic identity and contact details for the employee"
            icon3d="user"
          >
            <div className="rounded-xl border border-sky-200/80 bg-linear-to-b from-[#f8fbff]/60 to-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/30">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="First name" required error={errors.firstName}>
                  {(p) => (
                    <Input
                      {...p}
                      value={values.firstName}
                      disabled={submitting}
                      onChange={(e) =>
                        set("firstName", sanitizeName(e.target.value))
                      }
                      placeholder="e.g. Priya"
                    />
                  )}
                </FormField>

                <FormField label="Last name" required error={errors.lastName}>
                  {(p) => (
                    <Input
                      {...p}
                      value={values.lastName}
                      disabled={submitting}
                      onChange={(e) =>
                        set("lastName", sanitizeName(e.target.value))
                      }
                      placeholder="e.g. Sharma"
                    />
                  )}
                </FormField>

                <FormField
                  label="Mobile number"
                  required
                  error={errors.mobile}
                  hint="10 digits, starting with 6 to 9"
                >
                  {(p) => (
                    <Input
                      {...p}
                      inputMode="numeric"
                      value={values.mobile}
                      disabled={submitting}
                      onChange={(e) =>
                        set("mobile", sanitizeMobile(e.target.value))
                      }
                      placeholder="e.g. 9841055667"
                    />
                  )}
                </FormField>

                <FormField label="Email (sign-in)" required error={errors.email}>
                  {(p) => (
                    <Input
                      {...p}
                      type="email"
                      value={values.email}
                      disabled={submitting}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="e.g. priya.sharma@texawave.com"
                    />
                  )}
                </FormField>
              </div>
            </div>
          </FormSection>

          {/* Section 02: Organization & Employment */}
          <FormSection
            stepNumber="02"
            title="Organization"
            description="Departmental assignment, reporting team, and employment terms"
            icon3d="departments"
          >
            <div className="rounded-xl border border-sky-200/80 bg-linear-to-b from-[#f8fbff]/60 to-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/30">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FormField
                  label="Department"
                  required
                  error={errors.departmentId}
                >
                  {(p) => (
                    <Select
                      {...p}
                      value={values.departmentId}
                      disabled={submitting}
                      onChange={(e) => set("departmentId", e.target.value)}
                    >
                      <option value="">Select a department</option>
                      {departments.data?.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>

                <FormField label="Team" required error={errors.teamId}>
                  {(p) => (
                    <Select
                      {...p}
                      value={values.teamId}
                      disabled={submitting}
                      onChange={(e) => set("teamId", e.target.value)}
                    >
                      <option value="">Select a team</option>
                      {teams.data?.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>

                <FormField
                  label="Designation"
                  required
                  error={errors.designationId}
                >
                  {(p) => (
                    <Select
                      {...p}
                      value={values.designationId}
                      disabled={submitting}
                      onChange={(e) => set("designationId", e.target.value)}
                    >
                      <option value="">Select a designation</option>
                      {designations.data?.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>

                <FormField
                  label="Employment type"
                  required
                  error={errors.employmentTypeId}
                >
                  {(p) => (
                    <Select
                      {...p}
                      value={values.employmentTypeId}
                      disabled={submitting}
                      onChange={(e) => set("employmentTypeId", e.target.value)}
                    >
                      <option value="">Select an employment type</option>
                      {employmentTypes.data?.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>

                <FormField
                  label="Additional role"
                  error={errors.roleId}
                  hint="Every new hire gets the Employee self-service role automatically. Optionally add another role (e.g. Team Lead) on top of that."
                >
                  {(p) => (
                    <Select
                      {...p}
                      value={values.roleId}
                      disabled={submitting}
                      onChange={(e) => set("roleId", e.target.value)}
                    >
                      <option value="">Select a role</option>
                      {roles.data
                        ?.filter((r) => r.name !== "Employee")
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                    </Select>
                  )}
                </FormField>

                <FormField
                  label="Date of joining"
                  required
                  error={errors.dateOfJoining}
                >
                  {(p) => (
                    <DatePicker
                      {...p}
                      min="1900-01-01"
                      max="2099-12-31"
                      value={values.dateOfJoining}
                      disabled={submitting}
                      onChange={(e) => set("dateOfJoining", e.target.value)}
                    />
                  )}
                </FormField>
              </div>
            </div>
          </FormSection>

          {/* Section 03: Account Setup & Credentials */}
          <FormSection
            stepNumber="03"
            title="Account Setup"
            description="Initial security credentials for first-time login"
            icon3d="access-control"
          >
            <div className="rounded-xl border border-sky-200/80 bg-linear-to-b from-[#f8fbff]/60 to-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900/30 space-y-4">
              <div className="max-w-xl">
                <FormField
                  label="Temporary password"
                  required
                  error={errors.tempPassword}
                  labelAction={
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => {
                        const generated = generateSecurePassword();
                        set("tempPassword", generated);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200/90 bg-sky-50/70 px-2.5 py-1 text-[11px] font-bold text-brand-500 hover:bg-sky-100 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-900/50 transition-colors cursor-pointer"
                    >
                      <KeyRound className="h-3 w-3 text-brand-500" />
                      <span>Generate password</span>
                    </button>
                  }
                >
                  {(p) => (
                    <PasswordField
                      {...p}
                      value={values.tempPassword}
                      disabled={submitting}
                      onChange={(e) => set("tempPassword", e.target.value)}
                      placeholder="Enter or auto-generate secure temporary password"
                    />
                  )}
                </FormField>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-[#edf6ff]/60 p-3.5 text-[11px] text-[#2f6396] dark:border-slate-700 dark:bg-slate-800/40 dark:text-sky-300">
                <ShieldCheck className="h-4 w-4 shrink-0 text-brand-500 mt-0.5" />
                <p>
                  This temporary password will be securely provisioned to the user account. The new employee will be strictly required to configure their own password on their very first sign-in.
                </p>
              </div>
            </div>
          </FormSection>

          {/* Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-sky-200/90 bg-white p-4.5 shadow-[0_4px_24px_-4px_rgba(23,105,245,0.08)] dark:border-slate-700/80 dark:bg-gray-900">
            <Link
              href="/hr/employees"
              className="text-[12px] font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
              Cancel and return to employees
            </Link>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="secondary"
                disabled={submitting}
                onClick={() => router.push("/hr/employees")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={submitting}
                disabled={submitting}
                className="min-w-40 gap-2 shadow-theme-xs font-bold"
              >
                <UserPlus className="h-4 w-4" />
                <span>Create new hire</span>
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
