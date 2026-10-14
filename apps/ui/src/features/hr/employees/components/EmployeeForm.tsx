"use client";

import { useState } from "react";
import { Building2, CalendarCheck, User } from "lucide-react";
import { ApiError } from "@texawave-erp/core";
import { Alert, Button, FormField, Input, Select } from "@texawave-erp/ui-kit";
import { FormSection } from "@/features/hr/components/FormSection";
import { usePermission } from "@/hooks/usePermission";
import { WRITE_ALL } from "../permissions";
import { useDebouncedValue, useEmployees, useLookup, useTeams } from "../hooks";
import {
  employeeFormSchema,
  EMPTY_FORM,
  type EmployeeFormValues,
} from "../schema";

export interface EmployeeFormProps {
  initialValues?: EmployeeFormValues;
  /** Shown in the reporting-manager picker before a search is typed. */
  initialManager?: { id: number; label: string } | null;
  /** Label for the current team if the team list does not include it. */
  initialTeamName?: string;
  submitLabel: string;
  onSubmit: (values: EmployeeFormValues) => Promise<void>;
  onCancel: () => void;
}

/** Turns a failed save into one message the user can act on. */
export function describeSaveError(error: unknown): {
  message: string;
  details: string[];
} {
  if (error instanceof ApiError) {
    if (error.errorCode === "VERSION_CONFLICT") {
      return {
        message:
          "This employee was changed by someone else while you were editing. Reload the page to see the latest version, then apply your change again.",
        details: [],
      };
    }
    // Other 409s are duplicates the API names, e.g. "Another employee
    // already has this phone number" — show them as they are.
    if (error.statusCode === 409) {
      return { message: error.message, details: [] };
    }
    if (error.isPermissionError) {
      return {
        message: "You don't have permission to save this employee.",
        details: [],
      };
    }
    if (error.isValidationError) {
      return {
        message: "The server rejected some values. Fix them and try again.",
        details: error.fieldErrors,
      };
    }
    return { message: error.message, details: [] };
  }
  return { message: "Could not save this employee. Try again.", details: [] };
}

/**
 * Create and edit share this form. Client validation mirrors the API DTO; the
 * server's 400 messages are shown in one place, and the entered values are
 * kept when a save fails.
 */
export function EmployeeForm({
  initialValues,
  initialManager,
  initialTeamName,
  submitLabel,
  onSubmit,
  onCancel,
}: EmployeeFormProps) {
  const [values, setValues] = useState<EmployeeFormValues>(
    initialValues ?? EMPTY_FORM,
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof EmployeeFormValues, string>>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<{
    message: string;
    details: string[];
  } | null>(null);
  const [manager, setManager] = useState(initialManager ?? null);
  const [managerSearch, setManagerSearch] = useState("");
  const debouncedManagerSearch = useDebouncedValue(managerSearch.trim());

  const canWriteAll = usePermission(WRITE_ALL);
  const teams = useTeams(true);
  const departments = useLookup("/departments", true);
  const designations = useLookup("/master-data/designations", true);
  const employmentTypes = useLookup("/master-data/employment-types", true);
  const workLocations = useLookup("/master-data/work-locations", true);
  const managerMatches = useEmployees({
    page: 1,
    limit: 20,
    status: "ACTIVE",
    ...(debouncedManagerSearch ? { search: debouncedManagerSearch } : {}),
  });

  const set = <K extends keyof EmployeeFormValues>(key: K, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = employeeFormSchema.safeParse(values);
    if (!result.success) {
      const next: Partial<Record<keyof EmployeeFormValues, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !next[key as keyof EmployeeFormValues]) {
          next[key as keyof EmployeeFormValues] = issue.message;
        }
      }
      setErrors(next);
      setSaveError(null);
      return;
    }
    setErrors({});
    setSaveError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        ...values,
        reportsToId: manager ? String(manager.id) : "",
      });
    } catch (error) {
      setSaveError(describeSaveError(error));
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      {saveError ? (
        <Alert variant="error" title="Could not save">
          <p>{saveError.message}</p>
          {saveError.details.length > 0 ? (
            <ul className="mt-2 list-disc pl-5">
              {saveError.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}

      <FormSection
        stepNumber="01"
        title="Personal & Contact"
        description="Core employee identity and contact information"
        icon={User}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Full name" required error={errors.fullName}>
            {(f) => (
              <Input
                {...f}
                invalid={f.invalid}
                value={values.fullName}
                disabled={disabled}
                onChange={(e) => set("fullName", e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Work e-mail" error={errors.workEmail}>
            {(f) => (
              <Input
                {...f}
                type="email"
                invalid={f.invalid}
                value={values.workEmail}
                disabled={disabled}
                onChange={(e) => set("workEmail", e.target.value)}
              />
            )}
          </FormField>
          <FormField
            label="Phone"
            error={errors.phone}
            hint="Digits, spaces, + ( ) or -"
          >
            {(f) => (
              <Input
                {...f}
                type="tel"
                invalid={f.invalid}
                value={values.phone}
                disabled={disabled}
                onChange={(e) => set("phone", e.target.value)}
              />
            )}
          </FormField>
        </div>
      </FormSection>

      <FormSection
        stepNumber="02"
        title="Employment & Organization"
        description="Organizational placement, role, and reporting relationship"
        icon={Building2}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Team"
            required
            error={errors.teamId}
            hint={
              canWriteAll
                ? "The team decides who can see and manage this employee."
                : "Only organization-wide HR can move an employee to another team."
            }
          >
            {(f) => (
              <Select
                {...f}
                value={values.teamId}
                disabled={disabled || (!canWriteAll && Boolean(initialValues))}
                onChange={(e) => set("teamId", e.target.value)}
              >
                <option value="">Select a team</option>
                {/* Keep the current team visible even if the list omits it. */}
                {values.teamId &&
                !(teams.data ?? []).some(
                  (t) => String(t.id) === values.teamId,
                ) ? (
                  <option value={values.teamId}>
                    {initialTeamName ?? `Team ${values.teamId}`}
                  </option>
                ) : null}
                {(teams.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
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
            {(f) => (
              <Input
                {...f}
                type="date"
                invalid={f.invalid}
                value={values.dateOfJoining}
                disabled={disabled}
                onChange={(e) => set("dateOfJoining", e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Designation" required error={errors.designationId}>
            {(f) => (
              <Select
                {...f}
                value={values.designationId}
                disabled={disabled}
                onChange={(e) => set("designationId", e.target.value)}
              >
                <option value="">Select a designation</option>
                {(designations.data ?? []).map((d) => (
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
            {(f) => (
              <Select
                {...f}
                value={values.employmentTypeId}
                disabled={disabled}
                onChange={(e) => set("employmentTypeId", e.target.value)}
              >
                <option value="">Select an employment type</option>
                {(employmentTypes.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Department" error={errors.departmentId}>
            {(f) => (
              <Select
                {...f}
                value={values.departmentId}
                disabled={disabled}
                onChange={(e) => set("departmentId", e.target.value)}
              >
                <option value="">Use the team's department</option>
                {(departments.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Work location" error={errors.workLocationId}>
            {(f) => (
              <Select
                {...f}
                value={values.workLocationId}
                disabled={disabled}
                onChange={(e) => set("workLocationId", e.target.value)}
              >
                <option value="">None</option>
                {(workLocations.data ?? []).map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <div className="sm:col-span-2">
            <FormField
              label="Reporting manager"
              error={errors.reportsToId}
              hint="Only active employees can be selected."
            >
              {(f) => (
                <div className="flex flex-col gap-2">
                  <Input
                    {...f}
                    type="search"
                    aria-label="Search for reporting manager"
                    placeholder="Search active employees"
                    value={managerSearch}
                    disabled={disabled}
                    onChange={(e) => setManagerSearch(e.target.value)}
                  />
                  <Select
                    aria-label="Reporting manager"
                    value={manager ? String(manager.id) : ""}
                    disabled={disabled}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      const match = managerMatches.data?.data.find(
                        (m) => m.id === id,
                      );
                      setManager(
                        e.target.value && match
                          ? {
                              id,
                              label: `${match.fullName} (${match.employeeCode})`,
                            }
                          : null,
                      );
                    }}
                  >
                    <option value="">No reporting manager</option>
                    {manager ? (
                      <option value={manager.id}>{manager.label}</option>
                    ) : null}
                    {(managerMatches.data?.data ?? [])
                      .filter((m) => m.id !== manager?.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.fullName} ({m.employeeCode})
                        </option>
                      ))}
                  </Select>
                  {manager ? (
                    <button
                      type="button"
                      className="self-start text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                      onClick={() => setManager(null)}
                      disabled={disabled}
                    >
                      Clear manager
                    </button>
                  ) : null}
                </div>
              )}
            </FormField>
          </div>
        </div>
      </FormSection>

      <FormSection
        stepNumber="03"
        title="Probation & Referral"
        description="Probation and confirmation dates, referral and area of work"
        icon={CalendarCheck}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Probation ends"
            error={errors.probationEndDate}
            hint={
              canWriteAll
                ? "On or after the date of joining."
                : "Only organization-wide HR can change this."
            }
          >
            {(f) => (
              <Input
                {...f}
                type="date"
                invalid={f.invalid}
                value={values.probationEndDate}
                disabled={disabled || !canWriteAll}
                onChange={(e) => set("probationEndDate", e.target.value)}
              />
            )}
          </FormField>
          <FormField
            label="Confirmation date"
            error={errors.confirmationDate}
            hint={
              canWriteAll
                ? "On or after the date of joining."
                : "Only organization-wide HR can change this."
            }
          >
            {(f) => (
              <Input
                {...f}
                type="date"
                invalid={f.invalid}
                value={values.confirmationDate}
                disabled={disabled || !canWriteAll}
                onChange={(e) => set("confirmationDate", e.target.value)}
              />
            )}
          </FormField>
          <FormField
            label="Work domain"
            error={errors.workDomain}
            hint="e.g. Embedded systems, Textile, Operations"
          >
            {(f) => (
              <Input
                {...f}
                invalid={f.invalid}
                value={values.workDomain}
                disabled={disabled}
                onChange={(e) => set("workDomain", e.target.value)}
              />
            )}
          </FormField>
          <FormField
            label="Referred by"
            error={errors.referredBy}
            hint="Name or employee code of the referrer"
          >
            {(f) => (
              <Input
                {...f}
                invalid={f.invalid}
                value={values.referredBy}
                disabled={disabled}
                onChange={(e) => set("referredBy", e.target.value)}
              />
            )}
          </FormField>
        </div>
      </FormSection>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={disabled}
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
