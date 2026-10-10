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
  Sparkles,
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
  ErrorState,
  FormField,
  Input,
  Select,
  Skeleton,
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
import { FormSection, PasswordField } from "@/features/hr/components";

type FieldKey = keyof NewHireFormValues;

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
      roleId: Number(values.roleId),
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

    setErrors({});
    setSubmitting(true);
    try {
      const employee = await createNewHire(result.data);
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
        <Card className="rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-50 text-success-700 dark:bg-success-950 dark:text-success-300">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-title-sm font-bold tracking-tight text-gray-900 dark:text-white">
                New hire created
              </h1>
              <p className="text-theme-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {created.employee.fullName} ({created.employee.employeeCode})
                can now sign in.
              </p>
            </div>
          </div>

          <div className="mt-5">
            <Alert variant="warning" title="Share this temporary password once">
              It is shown only here. The employee must change it on their first
              sign-in.
            </Alert>
          </div>

          <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/40 space-y-3">
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Sign-in email
              </span>
              <p className="mt-0.5 font-medium text-theme-xs text-gray-900 dark:text-white">
                {created.email}
              </p>
            </div>

            <div className="border-t border-gray-200/60 pt-3 dark:border-gray-700/60">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Temporary password
              </span>
              <p className="mt-0.5 font-mono font-bold text-theme-sm text-gray-900 dark:text-white tracking-wide">
                {created.tempPassword}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
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
        </Card>
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
      {/* Header with Navigation Link */}
      <div className="space-y-2">
        <Link
          href="/hr/employees"
          className="inline-flex items-center gap-1.5 text-theme-xs font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to employees</span>
        </Link>

        <div className="flex items-center gap-2.5">
          <h1 className="text-title-sm font-bold tracking-tight text-gray-900 dark:text-white">
            New hire
          </h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold text-brand-800 dark:bg-brand-950 dark:text-brand-300">
            <Sparkles className="h-3 w-3 text-brand-600 dark:text-brand-400" />
            Provisioning Wizard
          </span>
        </div>

        <p className="text-theme-xs text-gray-500 dark:text-gray-400">
          Creates the employee record and their sign-in account. They will be
          required to change the temporary password on first login.
        </p>
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
            icon={User}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="First name" required error={errors.firstName}>
                {(p) => (
                  <Input
                    {...p}
                    value={values.firstName}
                    disabled={submitting}
                    onChange={(e) => set("firstName", e.target.value)}
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
                    onChange={(e) => set("lastName", e.target.value)}
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
                    onChange={(e) => set("mobile", e.target.value)}
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
          </FormSection>

          {/* Section 02: Organization & Employment */}
          <FormSection
            stepNumber="02"
            title="Organization"
            description="Departmental assignment, reporting team, and employment terms"
            icon={Building2}
          >
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

              <FormField label="Role" required error={errors.roleId}>
                {(p) => (
                  <Select
                    {...p}
                    value={values.roleId}
                    disabled={submitting}
                    onChange={(e) => set("roleId", e.target.value)}
                  >
                    <option value="">Select a role</option>
                    {roles.data?.map((r) => (
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
                  <Input
                    {...p}
                    type="date"
                    value={values.dateOfJoining}
                    disabled={submitting}
                    onChange={(e) => set("dateOfJoining", e.target.value)}
                  />
                )}
              </FormField>
            </div>
          </FormSection>

          {/* Section 03: Account Setup & Credentials */}
          <FormSection
            stepNumber="03"
            title="Account Setup"
            description="Initial security credentials for first-time login"
            icon={KeyRound}
          >
            <div className="max-w-xl">
              <FormField
                label="Temporary password"
                required
                error={errors.tempPassword}
              >
                {(p) => (
                  <PasswordField
                    {...p}
                    value={values.tempPassword}
                    disabled={submitting}
                    onChange={(e) => set("tempPassword", e.target.value)}
                    placeholder="Enter secure temporary password"
                  />
                )}
              </FormField>
            </div>
          </FormSection>

          {/* Actions Bar */}
          <div className="flex items-center justify-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
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
              className="min-w-36 shadow-theme-xs"
            >
              Create new hire
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
