"use client";

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
import { useState } from "react";
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

type FieldKey = keyof NewHireFormValues;

const sanitizeName = (raw: string) => raw.replace(/[^A-Za-z .'-]/g, "");
const sanitizeMobile = (raw: string) => raw.replace(/\D/g, "").slice(0, 10);

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

export function NewHireView() {
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
  }

  if (created) {
    return (
      <Card className="mx-auto max-w-2xl p-6">
        <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-gray-100">
          New hire created
        </h1>
        <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          {created.employee.fullName} ({created.employee.employeeCode}) can now
          sign in.
        </p>
        <div className="mt-6">
          <Alert variant="warning" title="Share this temporary password once">
            It is shown only here. They must change it on first sign-in.
          </Alert>
        </div>
        <dl className="mt-6 grid gap-3 text-theme-sm">
          <div>
            <dt className="text-gray-500 dark:text-gray-400">Sign-in email</dt>
            <dd className="font-medium text-gray-900 dark:text-gray-100">
              {created.email}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500 dark:text-gray-400">
              Temporary password
            </dt>
            <dd className="font-mono font-medium text-gray-900 dark:text-gray-100">
              {created.tempPassword}
            </dd>
          </div>
        </dl>
        <div className="mt-6 flex gap-3">
          <Button
            variant="secondary"
            onClick={() => copyPassword(created.tempPassword)}
          >
            {copied ? "Copied" : "Copy password"}
          </Button>
          <Button
            onClick={() => {
              setCreated(null);
              setCopied(false);
            }}
          >
            Add another hire
          </Button>
        </div>
      </Card>
    );
  }

  if (listFailed) {
    return (
      <ErrorState
        title="Could not load the form options"
        description="Teams, departments, designations, employment types, or roles failed to load."
        onRetry={() => lists.forEach((q) => void q.refetch())}
      />
    );
  }

  return (
    <Card className="mx-auto max-w-3xl p-6">
      <h1 className="text-theme-xl font-semibold text-gray-900 dark:text-gray-100">
        New hire
      </h1>
      <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
        Creates the employee record and their sign-in. They will be asked to
        change the temporary password.
      </p>

      {listsLoading ? (
        <div className="mt-6 flex flex-col gap-4" aria-busy="true">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-6 flex flex-col gap-4"
          noValidate
        >
          {submitError && (
            <Alert variant="error" title="Could not create the new hire">
              {submitError}
              {partialUserId !== null && (
                <span className="block">
                  The sign-in (user #{partialUserId}) was created. Remove it
                  from Users before retrying, so the email is free again.
                </span>
              )}
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="First name" required error={errors.firstName}>
              {(p) => (
                <Input
                  {...p}
                  value={values.firstName}
                  disabled={submitting}
                  onChange={(e) =>
                    set("firstName", sanitizeName(e.target.value))
                  }
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
                />
              )}
            </FormField>
            <FormField label="Department" required error={errors.departmentId}>
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
                <Input
                  {...p}
                  type="date"
                  min="1900-01-01"
                  max="2099-12-31"
                  value={values.dateOfJoining}
                  disabled={submitting}
                  onChange={(e) => set("dateOfJoining", e.target.value)}
                />
              )}
            </FormField>
            <FormField
              label="Temporary password"
              required
              error={errors.tempPassword}
              hint="At least 8 characters, with an uppercase letter, a lowercase letter, a number and a special character."
            >
              {(p) => (
                <Input
                  {...p}
                  type="text"
                  autoComplete="off"
                  value={values.tempPassword}
                  disabled={submitting}
                  onChange={(e) => set("tempPassword", e.target.value)}
                />
              )}
            </FormField>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="submit" loading={submitting} disabled={submitting}>
              Create new hire
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
